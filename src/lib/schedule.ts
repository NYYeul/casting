// 작품·배역 촬영 일정 계산. 순수 함수만 둔다.
// (리프 모듈 유지: node --test에서 바로 불러오도록 lib 내부 import를 두지 않는다)

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 촬영 기간을 날짜로 펼칠 때의 상한(약 4개월). 목록이 끝없이 길어지는 것을 막는다. */
export const MAX_SHOOT_DAYS = 120;

/** 실제로 있는 날짜인 YYYY-MM-DD 문자열인지 확인한다. (2026-02-30 같은 값은 거른다) */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 시작~종료(둘 다 포함)를 날짜 목록으로. 종료가 없거나 시작보다 빠르면 시작일 하루만. */
export function daysBetween(start: string, end?: string, cap = MAX_SHOOT_DAYS): string[] {
  if (!isIsoDate(start)) return [];
  const last = end && isIsoDate(end) && end >= start ? end : start;
  const days: string[] = [];
  for (let day = start; day <= last && days.length < cap; day = addDays(day, 1)) days.push(day);
  return days;
}

/** 날짜 목록 정리: 올바른 날짜만, 중복 없이, 오름차순으로. */
export function normalizeDates(dates: unknown, cap = MAX_SHOOT_DAYS): string[] {
  if (!Array.isArray(dates)) return [];
  return [...new Set(dates.filter(isIsoDate))].sort().slice(0, cap);
}

/**
 * 배역의 실제 촬영일.
 * - all(기본): 작품 촬영 기간 전체를 그대로 쓴다(일괄 적용).
 * - custom: 이 배역에 따로 지정한 날짜. 비어 있으면 작품 촬영 기간으로 대신한다.
 */
export function resolveRoleDates(
  mode: string,
  custom: unknown,
  projectStart: string,
  projectEnd?: string,
): string[] {
  const own = normalizeDates(custom);
  if (mode === 'custom' && own.length > 0) return own;
  return daysBetween(projectStart, projectEnd);
}

function shortDate(iso: string) {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

/**
 * 날짜 목록을 짧게 보여 준다. 이어진 날짜는 묶는다: "11/16–11/18, 11/23".
 * 묶음이 maxGroups보다 많으면 나머지는 "외 N일"로 줄인다.
 */
export function formatDates(dates: string[], maxGroups = 3): string {
  const sorted = normalizeDates(dates, 1000);
  if (sorted.length === 0) return '';
  const groups: [string, string][] = [];
  for (const day of sorted) {
    const last = groups[groups.length - 1];
    if (last && addDays(last[1], 1) === day) last[1] = day;
    else groups.push([day, day]);
  }
  const label = ([from, to]: [string, string]) =>
    from === to ? shortDate(from) : `${shortDate(from)}–${shortDate(to)}`;
  const shown = groups.slice(0, maxGroups).map(label).join(', ');
  const hiddenDays = groups
    .slice(maxGroups)
    .reduce((sum, [from, to]) => sum + daysBetween(from, to, 1000).length, 0);
  return hiddenDays > 0 ? `${shown} 외 ${hiddenDays}일` : shown;
}

/** 시작~종료 기간을 짧게: "11/16–11/30", 하루면 "11/16", 비었으면 ''. */
export function formatPeriod(start: string, end?: string) {
  if (!isIsoDate(start)) return '';
  if (!end || !isIsoDate(end) || end <= start) return shortDate(start);
  return `${shortDate(start)}–${shortDate(end)}`;
}
