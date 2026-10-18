/**
 * 캘린더 순수 헬퍼 — DB 의존 없음.
 * node --test가 직접 임포트할 수 있도록 상대 임포트 없는 리프 모듈로 분리한다.
 * (calendar.ts가 이 모듈을 re-export하므로 앱 코드는 '@/lib/calendar'만 사용)
 */

export type EventStatus = 'scheduled' | 'done' | 'canceled';
export type EventSource = 'offer' | 'manual';
/** 일정 유형: 대면 / 비대면 (미지정은 '') */
export type MeetingType = 'in-person' | 'remote';
/** 오퍼 출처 일정의 조율 상태 (chat_messages.status) */
export type OfferStatus = 'sent' | 'selected' | 'change_requested' | 'confirmed';

export const EVENT_STATUSES: EventStatus[] = ['scheduled', 'done', 'canceled'];
export const MEETING_TYPES: MeetingType[] = ['in-person', 'remote'];
export const MEETING_LABELS: Record<MeetingType, string> = {
  'in-person': '대면',
  remote: '비대면',
};

export type CalendarEvent = {
  id: string;
  title: string;
  actorName: string;
  /** 'HH:MM' 또는 종일이면 '' */
  time: string;
  status: EventStatus;
  source: EventSource;
  note: string;
  applicationId?: string;
  projectTitle?: string;
  /** 장소 또는 화상 링크 */
  place?: string;
  /** 대면/비대면 유형 (미지정이면 생략) */
  meetingType?: MeetingType;
  /** offer 출처 일정에만: 확정/조율/변경 요청 상태 */
  offerStatus?: OfferStatus;
};

export type MonthDay = { date: string; inMonth: boolean };

export const pad2 = (value: number) => String(value).padStart(2, '0');

/** KST 기준 오늘 'YYYY-MM-DD' */
export function todayKst() {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * 월간 그리드 (month 1-based, 월요일 시작).
 * 해당 월의 모든 날짜를 덮는 5~6주, 셀은 {date:'YYYY-MM-DD', inMonth}.
 */
export function buildMonthGrid(year: number, month: number): MonthDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const cursor = new Date(first);
  // 그 주의 월요일로 이동 (getUTCDay: 일=0 … 토=6 → 월=0 … 일=6)
  cursor.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const prefix = `${year}-${pad2(month)}`;
  const days: MonthDay[] = [];
  while (cursor <= last || days.length % 7 !== 0 || days.length < 35) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({ date, inMonth: date.startsWith(prefix) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const weeks: MonthDay[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

/**
 * 'YYYY-MM-DDTHH:MM', 'YYYY-MM-DD HH:MM', 'YYYY-MM-DDTHH:MM:SS', 'YYYY-MM-DD' →
 * 'YYYY-MM-DDTHH:MM' 또는 'YYYY-MM-DD'. 파싱 불가/존재하지 않는 날짜는 ''.
 */
export function normalizeStartsAt(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?$/.exec(text);
  if (!match) return '';
  const [, y, mo, d, hh, mm] = match;
  const check = new Date(Date.UTC(+y, +mo - 1, +d));
  if (check.getUTCFullYear() !== +y || check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d)
    return '';
  if (hh === undefined) return `${y}-${mo}-${d}`;
  if (+hh > 23 || +mm > 59) return '';
  return `${y}-${mo}-${d}T${hh}:${mm}`;
}

/** 'YYYY-MM-DDTHH:MM' 형태 슬롯 문자열 (오퍼 slots/selected_slot 필터용) */
export const SLOT_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const HHMM = /T(\d{2}):(\d{2})/;

function minutesOf(startsAt: string): number | null {
  const match = HHMM.exec(startsAt);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * 두 일시가 같은 날짜에 withinMinutes 미만으로 겹치는지.
 * 둘 다 'HH:MM'을 포함해야 하며, 동일 시각(차이 0)도 충돌로 본다.
 * 정확히 withinMinutes 간격(예: 60분)이면 붙여서 진행 가능 → 충돌 아님.
 */
export function timesConflict(a: string, b: string, withinMinutes = 60): boolean {
  if (a.slice(0, 10) !== b.slice(0, 10)) return false;
  const ma = minutesOf(a);
  const mb = minutesOf(b);
  return ma !== null && mb !== null && Math.abs(ma - mb) < withinMinutes;
}

/**
 * 오퍼 메시지에서 캘린더에 표시할 후보 슬롯 목록.
 * - confirmed/selected: 선택된 슬롯 1개
 * - sent: 배우가 아직 고르지 않았으므로 제안된 슬롯 전부(조율 중 후보)
 * - change_requested: 배우가 거절했으므로 대표로 가장 이른 제안 슬롯 1개
 * - declined 등: 표시할 일정 없음
 */
export function offerEventSlots(status: string, slots: string[], selectedSlot: string): string[] {
  if (status === 'confirmed' || status === 'selected')
    return SLOT_FORMAT.test(selectedSlot) ? [selectedSlot] : [];
  if (status === 'sent') return slots.filter((slot) => SLOT_FORMAT.test(slot));
  if (status === 'change_requested') {
    const first = slots.filter((slot) => SLOT_FORMAT.test(slot)).sort()[0];
    return first ? [first] : [];
  }
  return [];
}
