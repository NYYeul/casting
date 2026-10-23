import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRoleForActor } from '../src/lib/match.ts';

const profile = {
  gender: 'female',
  birthYear: 2001,
  region: '서울',
  intro: '웹드라마 조연 경험',
  tags: ['청순한', '사랑스러운'],
  skills: ['노래', '댄스'],
  unavailableDates: ['2099-01-01'],
};

const role = {
  title: '여주인공',
  description: '청순한 이미지의 20대 여성 배우를 찾습니다.',
  requirement: '노래 가능자 우대',
  location: '서울 마포',
  shootDate: '2099-02-01',
};

test('여러 조건이 맞으면 높은 점수와 이유를 돌려준다', () => {
  const { score, reasons } = matchRoleForActor(profile, role, 2026);
  assert.ok(score >= 55, `expected >=55 got ${score}`);
  assert.ok(reasons.some((item) => item.includes('성별')));
  assert.ok(reasons.some((item) => item.includes('지역')));
  assert.ok(reasons.some((item) => item.includes('청순한')));
  assert.ok(reasons.some((item) => item.includes('노래')));
});

test('조건이 하나도 안 맞으면 낮은 점수', () => {
  const other = { ...profile, gender: 'male', birthYear: 1980, region: '부산', tags: [], skills: [] };
  const { score } = matchRoleForActor(other, role, 2026);
  assert.ok(score <= 10, `expected low score got ${score}`);
});

test('촬영일이 출연 불가일과 겹치면 감점', () => {
  const busy = { ...profile, unavailableDates: ['2099-02-01'] };
  const free = matchRoleForActor(profile, role, 2026);
  const taken = matchRoleForActor(busy, role, 2026);
  assert.ok(taken.score < free.score);
  assert.ok(taken.reasons.some((item) => item.includes('겹침')));
});
