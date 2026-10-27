import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween,
  formatDates,
  formatPeriod,
  isIsoDate,
  normalizeDates,
  resolveRoleDates,
} from '../src/lib/schedule.ts';
import { ageRangeLabel, pickKnown, splitLocation } from '../src/lib/project-meta.ts';

test('실제로 있는 날짜만 날짜로 본다', () => {
  assert.equal(isIsoDate('2026-11-16'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-1-6'), false);
  assert.equal(isIsoDate(20261116), false);
});

test('촬영 기간을 날짜 목록으로 펼친다 (시작·종료 포함, 달이 바뀌어도)', () => {
  assert.deepEqual(daysBetween('2026-11-29', '2026-12-02'), [
    '2026-11-29',
    '2026-11-30',
    '2026-12-01',
    '2026-12-02',
  ]);
  // 종료일이 없거나 시작보다 빠르면 하루만
  assert.deepEqual(daysBetween('2026-11-16'), ['2026-11-16']);
  assert.deepEqual(daysBetween('2026-11-16', '2026-11-10'), ['2026-11-16']);
  assert.deepEqual(daysBetween(''), []);
  // 너무 긴 기간은 상한에서 자른다
  assert.equal(daysBetween('2026-01-01', '2027-12-31').length, 120);
});

test('날짜 목록은 올바른 날짜만, 중복 없이, 순서대로', () => {
  assert.deepEqual(normalizeDates(['2026-11-18', 'oops', '2026-11-16', '2026-11-18']), [
    '2026-11-16',
    '2026-11-18',
  ]);
  assert.deepEqual(normalizeDates('2026-11-16'), []);
});

test('배역 촬영일: 기본은 작품 촬영 기간을 일괄 적용한다', () => {
  assert.deepEqual(resolveRoleDates('all', ['2026-12-25'], '2026-11-16', '2026-11-18'), [
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
  ]);
});

test('배역 촬영일: 따로 지정하면 그 날짜만 (작품 기간 밖이어도)', () => {
  assert.deepEqual(
    resolveRoleDates('custom', ['2026-11-23', '2026-11-17'], '2026-11-16', '2026-11-18'),
    ['2026-11-17', '2026-11-23'],
  );
  // 따로 지정했는데 날짜가 없으면 작품 기간으로 대신한다
  assert.deepEqual(resolveRoleDates('custom', [], '2026-11-16', '2026-11-17'), [
    '2026-11-16',
    '2026-11-17',
  ]);
});

test('이어진 날짜는 묶어서 짧게 보여 준다', () => {
  assert.equal(
    formatDates(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-23']),
    '11/16–11/18, 11/23',
  );
  assert.equal(formatDates(['2026-11-16', '2026-11-20', '2026-11-25'], 1), '11/16 외 2일');
  assert.equal(formatDates([]), '');
  assert.equal(formatPeriod('2026-11-16', '2026-11-30'), '11/16–11/30');
  assert.equal(formatPeriod('2026-11-16', ''), '11/16');
  assert.equal(formatPeriod('', '2026-11-30'), '');
});

test('연령대 표시', () => {
  assert.equal(ageRangeLabel(20, 29), '20~29세');
  assert.equal(ageRangeLabel(20, 0), '20세 이상');
  assert.equal(ageRangeLabel(0, 29), '29세 이하');
  assert.equal(ageRangeLabel(0, 0), '');
});

test('정해진 목록에 있는 값만 남긴다', () => {
  assert.deepEqual(pickKnown(['ott', 'hack', 'ott', 'festival'], ['ott', 'festival']), [
    'ott',
    'festival',
  ]);
  assert.deepEqual(pickKnown('ott', ['ott']), []);
});

test('저장된 촬영 지역을 시·도와 상세 위치로 나눈다', () => {
  assert.deepEqual(splitLocation('서울 성동구'), { region: '서울', detail: '성동구' });
  assert.deepEqual(splitLocation('서울 성동구', '서울'), { region: '서울', detail: '성동구' });
  // 시·도 목록에 없는 예전 값은 통째로 상세 위치로
  assert.deepEqual(splitLocation('성수동 스튜디오'), { region: '', detail: '성수동 스튜디오' });
});
