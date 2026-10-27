import { randomUUID } from 'node:crypto';
import { db, listUpcomingAuditions } from './db';
import {
  normalizeStartsAt,
  offerEventSlots,
  pad2,
  SLOT_FORMAT,
  timesConflict,
} from './calendar-grid';
import type { CalendarEvent, EventStatus, MeetingType, OfferStatus } from './calendar-grid';

export {
  buildMonthGrid,
  EVENT_STATUSES,
  MEETING_LABELS,
  MEETING_TYPES,
  normalizeStartsAt,
  todayKst,
} from './calendar-grid';
export type {
  CalendarEvent,
  EventSource,
  EventStatus,
  MeetingType,
  MonthDay,
  OfferStatus,
} from './calendar-grid';

export type AuditionEvent = {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  actorName: string;
  /** 정규화된 'YYYY-MM-DDTHH:MM' 또는 'YYYY-MM-DD' */
  startsAt: string;
  status: EventStatus;
  note: string;
  /** 장소 또는 화상 링크 */
  place: string;
  /** 'in-person' | 'remote' | '' (미지정) */
  meetingType: MeetingType | '';
  applicationId: string | null;
  createdAt: string;
  projectTitle?: string;
};

export type EventConflict = { with: string; time: string };

type Row = Record<string, unknown>;

const EVENT_SELECT = `SELECT e.*, p.title project_title FROM audition_events e
  LEFT JOIN projects p ON p.id=e.project_id`;

function eventFromRow(row: Row): AuditionEvent {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: row.project_id ? String(row.project_id) : null,
    title: String(row.title),
    actorName: String(row.actor_name),
    startsAt: String(row.starts_at),
    status: row.status as EventStatus,
    note: String(row.note),
    place: String(row.place ?? ''),
    meetingType: (row.meeting_type ?? '') as MeetingType | '',
    applicationId: row.application_id ? String(row.application_id) : null,
    createdAt: String(row.created_at),
    ...(row.project_title ? { projectTitle: String(row.project_title) } : {}),
  };
}

function toCalendarEvent(event: AuditionEvent): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    actorName: event.actorName,
    time: event.startsAt.length >= 16 ? event.startsAt.slice(11, 16) : '',
    status: event.status,
    source: 'manual',
    note: event.note,
    ...(event.applicationId ? { applicationId: event.applicationId } : {}),
    ...(event.projectTitle ? { projectTitle: event.projectTitle } : {}),
    ...(event.place ? { place: event.place } : {}),
    ...(event.meetingType ? { meetingType: event.meetingType } : {}),
  };
}

function parseSlots(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.filter((slot) => typeof slot === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 해당 월의 수동 일정 + 채팅 오디션 오퍼를 날짜별로 병합한다.
 * 확정 오퍼 슬롯은 'YYYY-MM-DDTHH:MM'(KST) 문자열이므로 문자열 비교로 월 범위를 자른다.
 * 확정 외에도 지원서당 최신 오퍼가 조율 중(sent/selected)이거나 변경 요청
 * (change_requested)이면 '조율 중'·'변경 요청' 배지로 함께 표시한다 (읽기 전용).
 */
export async function listMonthEvents(
  ownerId: string,
  year: number,
  month: number,
): Promise<{ date: string; events: CalendarEvent[] }[]> {
  const monthStart = `${year}-${pad2(month)}-01`;
  const monthEnd = month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
  const inRange = (date: string) => date >= monthStart && date < monthEnd;
  const byDate = new Map<string, CalendarEvent[]>();
  const push = (date: string, event: CalendarEvent) => {
    const list = byDate.get(date);
    if (list) list.push(event);
    else byDate.set(date, [event]);
  };
  const rows = await db()
    .prepare(
      `${EVENT_SELECT} WHERE e.owner_id=? AND e.starts_at>=? AND e.starts_at<? ORDER BY e.starts_at ASC`,
    )
    .all(ownerId, monthStart, monthEnd);
  for (const row of rows) {
    const event = eventFromRow(row as Row);
    push(event.startsAt.slice(0, 10), toCalendarEvent(event));
  }
  // 확정 오퍼 병합: listUpcomingAuditions는 selected_slot >= now 이므로 월초를 넘겨 월 전체를 얻는다
  for (const offer of await listUpcomingAuditions(ownerId, `${monthStart}T00:00`)) {
    const slot = offer.slot;
    if (!SLOT_FORMAT.test(slot)) continue;
    const date = slot.slice(0, 10);
    if (!inRange(date)) continue;
    push(date, {
      id: `offer:${offer.applicationId}:${slot}`,
      title: `${offer.roleTitle} 오디션`,
      actorName: offer.name,
      time: slot.slice(11, 16),
      status: 'scheduled',
      source: 'offer',
      note: '',
      applicationId: offer.applicationId,
      offerStatus: 'confirmed',
      ...(offer.projectTitle ? { projectTitle: offer.projectTitle } : {}),
      ...(offer.place ? { place: offer.place } : {}),
    });
  }
  // 조율 중 오퍼 병합: 지원서별 '최신' 오퍼가 미확정 상태일 때만 (이전 오퍼는 새 제안으로 대체됨)
  const pendingOffers = await db()
    .prepare(
      `SELECT m.status, m.slots, m.selected_slot, m.place, m.application_id,
        a.name actor_name, r.title role_title, r.project_title
      FROM chat_messages m
      JOIN applications a ON a.id=m.application_id
      JOIN roles r ON r.id=a.role_id
      WHERE r.owner_id=? AND m.kind='offer' AND m.status IN ('sent','selected','change_requested')
        AND m.created_at=(
          SELECT MAX(n.created_at) FROM chat_messages n
          WHERE n.application_id=m.application_id AND n.kind='offer'
        )`,
    )
    .all(ownerId);
  for (const row of pendingOffers as Row[]) {
    const offerStatus = String(row.status) as OfferStatus;
    const applicationId = String(row.application_id);
    const meta = {
      actorName: String(row.actor_name),
      title: `${row.role_title} 오디션`,
      applicationId,
      ...(row.project_title ? { projectTitle: String(row.project_title) } : {}),
      ...(row.place ? { place: String(row.place) } : {}),
    };
    for (const slot of offerEventSlots(
      offerStatus,
      parseSlots(row.slots),
      String(row.selected_slot),
    )) {
      const date = slot.slice(0, 10);
      if (!inRange(date)) continue;
      push(date, {
        id: `offer:${offerStatus}:${applicationId}:${slot}`,
        title: meta.title,
        actorName: meta.actorName,
        time: slot.slice(11, 16),
        status: 'scheduled',
        source: 'offer',
        note: '',
        applicationId: meta.applicationId,
        offerStatus,
        ...(meta.projectTitle ? { projectTitle: meta.projectTitle } : {}),
        ...(meta.place ? { place: meta.place } : {}),
      });
    }
  }
  for (const events of byDate.values())
    events.sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({ date, events }));
}

async function projectOwnedBy(projectId: string, ownerId: string) {
  return Boolean(
    await db().prepare('SELECT 1 FROM projects WHERE id=? AND owner_id=?').get(projectId, ownerId),
  );
}

export async function getEvent(id: string, ownerId: string) {
  const row = await db().prepare(`${EVENT_SELECT} WHERE e.id=? AND e.owner_id=?`).get(id, ownerId);
  return row ? eventFromRow(row as Row) : null;
}

export async function createEvent(
  ownerId: string,
  input: {
    title: string;
    actorName: string;
    startsAt: string;
    projectId?: string | null;
    note?: string;
    place?: string;
    meetingType?: MeetingType | '';
  },
) {
  const projectId = input.projectId || null;
  if (projectId && !(await projectOwnedBy(projectId, ownerId)))
    return { error: '프로젝트를 찾을 수 없습니다.' } as const;
  const id = randomUUID();
  await db()
    .prepare(
      `INSERT INTO audition_events
        (id,owner_id,project_id,title,actor_name,starts_at,status,note,place,meeting_type,created_at)
      VALUES (?,?,?,?,?,?,'scheduled',?,?,?,?)`,
    )
    .run(
      id,
      ownerId,
      projectId,
      input.title,
      input.actorName,
      normalizeStartsAt(input.startsAt) || input.startsAt,
      input.note ?? '',
      input.place ?? '',
      input.meetingType ?? '',
      new Date().toISOString(),
    );
  return { event: (await getEvent(id, ownerId))! } as const;
}

export async function updateEvent(
  ownerId: string,
  id: string,
  input: {
    status?: EventStatus;
    note?: string;
    startsAt?: string;
    place?: string;
    meetingType?: MeetingType | '';
  },
) {
  const current = await getEvent(id, ownerId);
  if (!current) return null;
  await db()
    .prepare(
      `UPDATE audition_events SET status=?,note=?,starts_at=?,place=?,meeting_type=?
      WHERE id=? AND owner_id=?`,
    )
    .run(
      input.status ?? current.status,
      input.note ?? current.note,
      input.startsAt ?? current.startsAt,
      input.place ?? current.place,
      input.meetingType ?? current.meetingType,
      id,
      ownerId,
    );
  return await getEvent(id, ownerId);
}

/**
 * 같은 소유자·같은 날짜에 시각이 60분 미만으로 겹치는 기존 일정을 찾는다.
 * 수동 일정(취소 건 제외)과 확정 오퍼 슬롯을 검사한다. 시간 없는 종일 일정은 비교 불가로 제외.
 * 생성 직후/PATCH 검증 시 자기 자신은 excludeId로 건너뛴다.
 */
export async function findTimeConflict(
  ownerId: string,
  startsAt: string,
  excludeId = '',
): Promise<EventConflict | null> {
  const normalized = normalizeStartsAt(startsAt) || startsAt;
  if (normalized.length < 16) return null;
  const date = normalized.slice(0, 10);
  const rows = (await db()
    .prepare(
      `SELECT id, title, starts_at FROM audition_events
      WHERE owner_id=? AND substr(starts_at,1,10)=? AND status!='canceled'`,
    )
    .all(ownerId, date)) as Row[];
  for (const row of rows) {
    if (String(row.id) === excludeId) continue;
    if (timesConflict(normalized, String(row.starts_at)))
      return { with: String(row.title), time: String(row.starts_at).slice(11, 16) };
  }
  const offers = (await db()
    .prepare(
      `SELECT m.selected_slot, r.title role_title
      FROM chat_messages m
      JOIN applications a ON a.id=m.application_id
      JOIN roles r ON r.id=a.role_id
      WHERE r.owner_id=? AND m.kind='offer' AND m.status='confirmed'
        AND substr(m.selected_slot,1,10)=?`,
    )
    .all(ownerId, date)) as Row[];
  for (const row of offers) {
    if (timesConflict(normalized, String(row.selected_slot)))
      return {
        with: `${row.role_title} 오디션`,
        time: String(row.selected_slot).slice(11, 16),
      };
  }
  return null;
}

export async function deleteEvent(ownerId: string, id: string) {
  const result = await db()
    .prepare('DELETE FROM audition_events WHERE id=? AND owner_id=?')
    .run(id, ownerId);
  return result.changes > 0;
}
