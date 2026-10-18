import test from 'node:test';
import assert from 'node:assert/strict';
// 순수 헬퍼는 리프 모듈에서 직접 임포트 (calendar.ts는 ./db를 참조해 node --test에서 로드 불가)
import {
  buildMonthGrid,
  MEETING_LABELS,
  MEETING_TYPES,
  normalizeStartsAt,
  offerEventSlots,
  SLOT_FORMAT,
  timesConflict,
} from '../src/lib/calendar-grid.ts';

const flat = (weeks) => weeks.flat();
const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 일=0, 월=1 …

test('월간 그리드: 월요일 시작, 7열, 5~6주', () => {
  const weeks = buildMonthGrid(2026, 10); // 2026-10-01 = 목요일, 31일
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every((week) => week.length === 7));
  // 첫 셀은 월요일(그 달 1일 이전/당일), 마지막 셀은 일요일
  assert.equal(weeks[0][0].date, '2026-09-28');
  assert.equal(dayOfWeek(weeks[0][0].date), 1);
  const all = flat(weeks);
  assert.equal(dayOfWeek(all.at(-1).date), 0);
  assert.equal(all.at(-1).date, '2026-11-01');
});

test('월간 그리드: inMonth 플래그와 해당 월 일수', () => {
  const weeks = buildMonthGrid(2026, 10);
  const all = flat(weeks);
  assert.equal(all.filter((day) => day.inMonth).length, 31);
  assert.equal(all.find((day) => day.date === '2026-10-01').inMonth, true);
  assert.equal(all.find((day) => day.date === '2026-09-28').inMonth, false);
  assert.equal(all.find((day) => day.date === '2026-11-01').inMonth, false);
});

test('월간 그리드: 6주가 필요한 달 (2026-11)', () => {
  const weeks = buildMonthGrid(2026, 11); // 2026-11-01 = 일요일, 30일
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0][0].date, '2026-10-26');
  assert.equal(flat(weeks).at(-1).date, '2026-12-06');
  assert.equal(flat(weeks).filter((day) => day.inMonth).length, 30);
});

test('월간 그리드: 1일이 월요일인 28일짜리 달도 5주로 패딩 (2027-02)', () => {
  const weeks = buildMonthGrid(2027, 2); // 2027-02-01 = 월요일
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].date, '2027-02-01');
  assert.equal(flat(weeks).at(-1).date, '2027-03-07');
  assert.equal(flat(weeks).filter((day) => day.inMonth).length, 28);
});

test('startsAt 정규화: 관대한 입력 → ISO 형태', () => {
  assert.equal(normalizeStartsAt('2026-10-05T14:00'), '2026-10-05T14:00');
  assert.equal(normalizeStartsAt('2026-10-05 14:00'), '2026-10-05T14:00');
  assert.equal(normalizeStartsAt('2026-10-05T14:00:30'), '2026-10-05T14:00');
  assert.equal(normalizeStartsAt('2026-10-05'), '2026-10-05');
  assert.equal(normalizeStartsAt(' 2026-10-05T09:30 '), '2026-10-05T09:30');
});

test('startsAt 정규화: 잘못된 입력은 빈 문자열', () => {
  assert.equal(normalizeStartsAt(''), '');
  assert.equal(normalizeStartsAt('not a date'), '');
  assert.equal(normalizeStartsAt('2026-02-30'), '');
  assert.equal(normalizeStartsAt('2026-13-01'), '');
  assert.equal(normalizeStartsAt('2026-10-05T25:00'), '');
  assert.equal(normalizeStartsAt('2026-10-05T12:60'), '');
  assert.equal(normalizeStartsAt(null), '');
  assert.equal(normalizeStartsAt(20261005), '');
});

test('시간 충돌: 같은 날 60분 미만이면 충돌', () => {
  // 동일 HH:MM도 충돌
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T14:00'), true);
  // 30분·59분 차이 → 충돌
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T14:30'), true);
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T13:01'), true);
});

test('시간 충돌: 60분 이상 간격·다른 날·종일은 충돌 아님', () => {
  // 정확히 60분 간격은 붙여서 진행 가능 → 충돌 아님
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T15:00'), false);
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T12:00'), false);
  // 날짜가 다르면 시간이 같아도 충돌 아님
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-06T14:00'), false);
  // 종일(HH:MM 없음)은 비교 불가
  assert.equal(timesConflict('2026-10-05', '2026-10-05T14:00'), false);
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05'), false);
  // 커스텀 간격
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T14:20', 30), true);
  assert.equal(timesConflict('2026-10-05T14:00', '2026-10-05T14:30', 30), false);
});

test('오퍼 슬롯 확장: 상태별 캘린더 표시 슬롯', () => {
  const slots = ['2026-10-05T14:00', '2026-10-05T16:00', '2026-10-06T11:00'];
  // sent: 배우 미선택 → 제안 슬롯 전부가 '조율 중' 후보
  assert.deepEqual(offerEventSlots('sent', slots, ''), slots);
  // selected/confirmed: 선택된 슬롯만
  assert.deepEqual(offerEventSlots('selected', slots, '2026-10-05T16:00'), ['2026-10-05T16:00']);
  assert.deepEqual(offerEventSlots('confirmed', [], '2026-10-05T16:00'), ['2026-10-05T16:00']);
  // change_requested: 대표로 가장 이른 제안 슬롯
  assert.deepEqual(
    offerEventSlots('change_requested', ['2026-10-06T11:00', '2026-10-05T14:00'], ''),
    ['2026-10-05T14:00'],
  );
  // declined·선택 슬롯 없음 → 표시할 일정 없음
  assert.deepEqual(offerEventSlots('declined', slots, ''), []);
  assert.deepEqual(offerEventSlots('selected', slots, ''), []);
  assert.deepEqual(offerEventSlots('confirmed', slots, 'not-a-slot'), []);
  assert.deepEqual(offerEventSlots('sent', [], ''), []);
  // 잘못된 슬롯 문자열은 걸러진다
  assert.deepEqual(offerEventSlots('sent', ['2026-10-05T14:00', 'bad', ''], ''), [
    '2026-10-05T14:00',
  ]);
});

test('SLOT_FORMAT/유형 상수', () => {
  assert.equal(SLOT_FORMAT.test('2026-10-05T14:00'), true);
  assert.equal(SLOT_FORMAT.test('2026-10-05'), false);
  assert.deepEqual(MEETING_TYPES, ['in-person', 'remote']);
  assert.equal(MEETING_LABELS.remote, '비대면');
  assert.equal(MEETING_LABELS['in-person'], '대면');
});
