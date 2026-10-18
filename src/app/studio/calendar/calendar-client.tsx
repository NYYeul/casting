'use client';

import { useCallback, useState } from 'react';
import ProducerNav from '@/components/producer-nav';
// 클라이언트 번들에 DB(calendar.ts → node:sqlite)가 끌려가지 않도록 리프 모듈에서 가져온다
import { MEETING_LABELS } from '@/lib/calendar-grid';
import type { CalendarEvent, EventStatus, MonthDay } from '@/lib/calendar-grid';
import styles from './calendar.module.css';

type ProjectOption = { id: string; title: string };

type Props = {
  initialMonth: string;
  initialWeeks: MonthDay[][];
  initialDays: Record<string, CalendarEvent[]>;
  today: string;
  projects: ProjectOption[];
};

const DOW = ['월', '화', '수', '목', '금', '토', '일'];
const CHIP_LIMIT = 3;
const VIEWS = [
  ['month', '월간'],
  ['list', '목록'],
] as const;

const STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: '예정',
  done: '완료',
  canceled: '취소',
};
function tone(event: CalendarEvent) {
  if (event.status === 'canceled') return styles.tMute;
  if (event.source === 'offer') {
    if (event.offerStatus === 'change_requested') return styles.tWarn;
    if (event.offerStatus === 'sent' || event.offerStatus === 'selected') return styles.tWait;
    return styles.tConfirm;
  }
  if (event.status === 'done') return styles.tConfirm;
  return styles.tWait;
}

function badgeOf(event: CalendarEvent) {
  if (event.source === 'offer') {
    if (event.offerStatus === 'change_requested') return { label: '변경 요청', tone: styles.tWarn };
    if (event.offerStatus === 'sent' || event.offerStatus === 'selected')
      return { label: '조율 중', tone: styles.tWait };
    return { label: '확정', tone: styles.tConfirm };
  }
  if (event.status === 'done') return { label: '완료', tone: styles.tConfirm };
  if (event.status === 'canceled') return { label: '취소', tone: styles.tMute };
  return { label: '예정', tone: styles.tWait };
}

function offerHint(event: CalendarEvent) {
  if (event.offerStatus === 'change_requested')
    return '배우가 일정 변경을 요청했습니다. 대화에서 새 시간을 제안하세요.';
  if (event.offerStatus === 'sent') return '채팅에서 조율 중인 제안 시간입니다.';
  if (event.offerStatus === 'selected') return '배우가 선택한 시간입니다. 대화에서 확정해 주세요.';
  return '채팅에서 확정된 일정입니다. 변경은 메시지에서 진행하세요.';
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function dayLabel(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

function weekdayLabel(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 일=0 … 토=6
  return DOW[(dow + 6) % 7]; // 월=0 … 일=6
}

const EMPTY_FORM = {
  title: '',
  actorName: '',
  date: '',
  time: '14:00',
  projectId: '',
  place: '',
  meetingType: '' as '' | 'in-person' | 'remote',
  note: '',
};

export default function CalendarClient({
  initialMonth,
  initialWeeks,
  initialDays,
  today,
  projects,
}: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [weeks, setWeeks] = useState(initialWeeks);
  const [days, setDays] = useState(initialDays);
  const [selected, setSelected] = useState<string | null>(
    today.startsWith(initialMonth) ? today : null,
  );
  const [view, setView] = useState<'month' | 'list'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (target: string, keepSelection = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/calendar?month=${target}`, { cache: 'no-store' });
      if (response.status === 401) {
        location.href = '/login?next=/studio/calendar';
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '일정을 불러오지 못했습니다.');
      setMonth(data.month);
      setWeeks(data.weeks);
      setDays(data.days);
      if (!keepSelection) setSelected(null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const move = (delta: number) => void load(shiftMonth(month, delta));

  const openForm = () => {
    setForm({ ...EMPTY_FORM, date: selected || (today.startsWith(month) ? today : `${month}-01`) });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          actorName: form.actorName,
          startsAt: form.time ? `${form.date}T${form.time}` : form.date,
          projectId: form.projectId || undefined,
          place: form.place || undefined,
          meetingType: form.meetingType || undefined,
          note: form.note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '일정을 저장하지 못했습니다.');
      if (data.conflict)
        setNotice(
          `저장했지만 ${data.conflict.time}의 ‘${data.conflict.with}’ 일정과 시간이 겹칩니다.`,
        );
      const eventDate = String(data.event.startsAt).slice(0, 10);
      setFormOpen(false);
      if (eventDate.startsWith(month)) setSelected(eventDate);
      await load(eventDate.slice(0, 7), eventDate.startsWith(month));
      if (eventDate.startsWith(month)) setSelected(eventDate);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '일정을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/calendar/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || '일정을 수정하지 못했습니다.');
      return;
    }
    if (data.conflict)
      setNotice(`‘${data.conflict.with}’ 일정(${data.conflict.time})과 시간이 겹칩니다.`);
    await load(month, true);
  };

  const remove = async (id: string) => {
    if (!window.confirm('이 일정을 삭제할까요?')) return;
    const response = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || '일정을 삭제하지 못했습니다.');
      return;
    }
    await load(month, true);
  };

  const monthCount = Object.values(days).reduce((sum, events) => sum + events.length, 0);
  const listDates = Object.keys(days).sort();
  const selectedEvents = selected ? (days[selected] ?? []) : [];
  const [yearNum, monthNum] = month.split('-').map(Number);

  return (
    <main className="app-shell wide">
      <ProducerNav active="calendar" />
      <div className="screen-pad page-top">
        <h1 className="page-title">오디션 일정</h1>
        <div className={styles.toolbar}>
          <div className={styles.monthNav}>
            <button
              className={styles.navBtn}
              onClick={() => move(-1)}
              aria-label="이전 달"
              disabled={loading}
            >
              ‹
            </button>
            <strong className={styles.monthLabel} aria-live="polite">
              {yearNum}년 {monthNum}월
            </strong>
            <button
              className={styles.navBtn}
              onClick={() => move(1)}
              aria-label="다음 달"
              disabled={loading}
            >
              ›
            </button>
            <button
              className={styles.todayBtn}
              onClick={() => void load(today.slice(0, 7))}
              disabled={loading || month === today.slice(0, 7)}
            >
              오늘
            </button>
          </div>
          <div className={styles.toolbarRight}>
            <div className={styles.seg} role="group" aria-label="보기 방식">
              {VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  className={`${styles.segBtn} ${view === key ? styles.segOn : ''}`}
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className={styles.addBtn} onClick={openForm}>
              ＋ 일정 추가
            </button>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {formOpen && (
          <section className={styles.form} aria-label="일정 추가">
            <div className={styles.formHead}>
              <strong>일정 추가</strong>
              <button className={styles.formClose} onClick={() => setFormOpen(false)}>
                닫기
              </button>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>제목 *</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="예: 1차 대면 오디션"
                  maxLength={100}
                />
              </label>
              <label className={styles.field}>
                <span>배우 이름 *</span>
                <input
                  value={form.actorName}
                  onChange={(event) => setForm({ ...form, actorName: event.target.value })}
                  placeholder="예: 김도윤"
                  maxLength={60}
                />
              </label>
              <label className={styles.field}>
                <span>날짜 *</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>시간</span>
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>프로젝트</span>
                <select
                  value={form.projectId}
                  onChange={(event) => setForm({ ...form, projectId: event.target.value })}
                >
                  <option value="">연결 안 함</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>장소</span>
                <input
                  value={form.place}
                  onChange={(event) => setForm({ ...form, place: event.target.value })}
                  placeholder="예: 스튜디오 3층 / 화상 링크"
                  maxLength={200}
                />
              </label>
              <label className={styles.field}>
                <span>유형</span>
                <select
                  value={form.meetingType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      meetingType: event.target.value as '' | 'in-person' | 'remote',
                    })
                  }
                >
                  <option value="">선택 안 함</option>
                  <option value="in-person">대면</option>
                  <option value="remote">비대면</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>메모</span>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  placeholder="장소, 준비물, 참고 사항"
                  rows={2}
                  maxLength={500}
                />
              </label>
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button
              className="button button-primary full"
              disabled={busy || !form.title || !form.actorName || !form.date}
              onClick={() => void submit()}
            >
              {busy ? '저장 중…' : '일정 저장'}
            </button>
          </section>
        )}

        <div className={styles.layout}>
          {view === 'month' ? (
            <section className={styles.calCard} aria-label="월간 캘린더">
              <div className={styles.dowRow}>
                {DOW.map((day, index) => (
                  <span
                    key={day}
                    className={`${styles.dow} ${index >= 5 ? styles.dowWeekend : ''}`}
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div className={styles.grid}>
                {weeks.flat().map((day) => {
                  const events = days[day.date] ?? [];
                  const isToday = day.date === today;
                  const isSelected = day.date === selected;
                  return (
                    <button
                      key={day.date}
                      className={`${styles.cell} ${day.inMonth ? '' : styles.cellDim} ${
                        isToday ? styles.cellToday : ''
                      } ${isSelected ? styles.cellSel : ''}`}
                      onClick={() => setSelected(day.date)}
                      aria-label={`${dayLabel(day.date)}${events.length ? `, 일정 ${events.length}개` : ''}`}
                      aria-pressed={isSelected}
                    >
                      <span className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ''}`}>
                        {Number(day.date.slice(8, 10))}
                      </span>
                      <span className={styles.chips}>
                        {events.slice(0, CHIP_LIMIT).map((event) => (
                          <span
                            key={event.id}
                            className={`${styles.chip} ${tone(event)} ${
                              event.status === 'canceled' ? styles.strike : ''
                            }`}
                          >
                            {event.time ? `${event.time} ` : ''}
                            {event.actorName}
                            {event.meetingType === 'remote'
                              ? ' · 비대면'
                              : event.place
                                ? ` · ${event.place}`
                                : ''}
                          </span>
                        ))}
                        {events.length > CHIP_LIMIT && (
                          <span className={styles.more}>+{events.length - CHIP_LIMIT}개 더</span>
                        )}
                      </span>
                      <span className={styles.dots} aria-hidden>
                        {events.slice(0, 4).map((event) => (
                          <i key={event.id} className={`${styles.dot} ${tone(event)}`} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {monthCount === 0 && !loading && (
                <p className={styles.emptyMonth}>
                  이 달에 등록된 일정이 없습니다. 오른쪽 위 ‘일정 추가’로 기록해 보세요.
                </p>
              )}
            </section>
          ) : (
            <section className={styles.calCard} aria-label="일정 목록">
              {listDates.length === 0 && !loading && (
                <p className={styles.emptyMonth}>
                  이 달에 등록된 일정이 없습니다. 오른쪽 위 ‘일정 추가’로 기록해 보세요.
                </p>
              )}
              {listDates.map((date) => (
                <div key={date} className={styles.listGroup}>
                  <h3
                    className={`${styles.listDate} ${date === today ? styles.listDateToday : ''}`}
                  >
                    {dayLabel(date)} ({weekdayLabel(date)}){date === today ? ' · 오늘' : ''}
                  </h3>
                  {(days[date] ?? []).map((event) => {
                    const badge = badgeOf(event);
                    const canceled = event.status === 'canceled';
                    return (
                      <button
                        key={event.id}
                        className={`${styles.listRow} ${date === selected ? styles.listRowSel : ''}`}
                        onClick={() => setSelected(date)}
                      >
                        <span className={styles.listTime}>{event.time || '종일'}</span>
                        <span className={styles.listMain}>
                          <strong className={canceled ? styles.strike : ''}>{event.title}</strong>
                          <span className={styles.listSub}>
                            {event.actorName}
                            {event.projectTitle ? ` · ${event.projectTitle}` : ''}
                            {event.place ? ` · ${event.place}` : ''}
                          </span>
                        </span>
                        {event.meetingType === 'remote' && (
                          <span className={`${styles.badge} ${styles.tAuto}`}>비대면</span>
                        )}
                        <span className={`${styles.badge} ${badge.tone}`}>{badge.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </section>
          )}

          <aside className={styles.detail} aria-label="선택한 날짜의 일정">
            <h2 className={styles.detailTitle}>
              {selected ? `${dayLabel(selected)} 일정` : '날짜를 선택하세요'}
            </h2>
            {!selected && (
              <p className={styles.hint}>달력에서 날짜를 누르면 그날의 일정을 볼 수 있습니다.</p>
            )}
            {selected && selectedEvents.length === 0 && (
              <div className={styles.empty}>
                등록된 일정이 없습니다.
                <button className={styles.inlineAdd} onClick={openForm}>
                  이 날짜에 일정 추가
                </button>
              </div>
            )}
            {selectedEvents.map((event) => {
              const badge = badgeOf(event);
              return (
                <article key={event.id} className={styles.evCard}>
                  <div className={styles.evHead}>
                    <span className={styles.evTime}>{event.time || '종일'}</span>
                    <span className={`${styles.badge} ${badge.tone}`}>{badge.label}</span>
                    {event.meetingType === 'remote' && (
                      <span className={`${styles.badge} ${styles.tAuto}`}>비대면</span>
                    )}
                    {event.meetingType === 'in-person' && (
                      <span className={`${styles.badge} ${styles.tMute}`}>대면</span>
                    )}
                    {event.source === 'offer' && (
                      <span className={`${styles.badge} ${styles.tAuto}`}>자동</span>
                    )}
                  </div>
                  <h3
                    className={`${styles.evTitle} ${
                      event.status === 'canceled' ? styles.strike : ''
                    }`}
                  >
                    {event.title}
                  </h3>
                  <p className={styles.evMeta}>
                    {event.actorName}
                    {event.projectTitle ? ` · ${event.projectTitle}` : ''}
                  </p>
                  {event.place && (
                    <p className={styles.evNote}>
                      장소 · {event.place}
                      {event.meetingType ? ` (${MEETING_LABELS[event.meetingType]})` : ''}
                    </p>
                  )}
                  {event.note && <p className={styles.evNote}>{event.note}</p>}
                  {event.source === 'manual' && (
                    <div className={styles.evActions}>
                      <div className={styles.seg} role="group" aria-label="상태 변경">
                        {(Object.keys(STATUS_LABEL) as EventStatus[]).map((status) => (
                          <button
                            key={status}
                            className={`${styles.segBtn} ${
                              event.status === status ? styles.segOn : ''
                            }`}
                            disabled={event.status === status}
                            onClick={() => void patch(event.id, { status })}
                          >
                            {STATUS_LABEL[status]}
                          </button>
                        ))}
                      </div>
                      <button className={styles.delBtn} onClick={() => void remove(event.id)}>
                        삭제
                      </button>
                    </div>
                  )}
                  {event.source === 'offer' && <p className={styles.hint}>{offerHint(event)}</p>}
                </article>
              );
            })}
          </aside>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice('')}>
          {notice}
          <button aria-label="닫기">×</button>
        </div>
      )}
    </main>
  );
}
