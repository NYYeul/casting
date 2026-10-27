import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreActor, koreanAge, MAX_SCORE } from '../src/lib/fit.ts';

const YEAR = 2026;

const actor = {
  gender: 'male',
  birthYear: 1999, // 2026년 기준 28세
  height: 181,
  region: '서울 마포구',
  intro: '액션과 사투리 연기가 가능한 단편영화 배우입니다.',
  tags: ['소년미', '따뜻한', '차분한', '카리스마'],
  skills: ['액션', '영어', '운전'],
  unavailableDates: ['2026-11-20'],
};

const fullBrief = {
  gender: 'male',
  ageMin: 25,
  ageMax: 30,
  heightMin: 175,
  heightMax: 190,
  region: '서울',
  tags: ['소년미', '따뜻한', '차분한', '카리스마'],
  skills: ['액션', '영어', '운전'],
  keywords: ['액션', '사투리', '단편영화'],
  shootDate: '2026-12-01',
};

test('모든 조건이 맞으면 상한 점수 95를 받는다', () => {
  const { score, reasons } = scoreActor(actor, fullBrief, YEAR);
  assert.equal(score, MAX_SCORE);
  assert.equal(score, 95);
  assert.ok(reasons.includes('성별 조건 부합'));
  assert.ok(reasons.includes('연령 조건 부합'));
  assert.ok(reasons.includes('키 조건 부합'));
  assert.ok(reasons.includes('지역 일치'));
  assert.ok(reasons.includes('촬영 일정 문제없음'));
  assert.ok(reasons.some((reason) => reason.startsWith('이미지 태그 4개 일치')));
  assert.ok(reasons.some((reason) => reason.startsWith('특기 일치 (액션')));
  assert.ok(reasons.some((reason) => reason.startsWith('소개글 키워드 일치')));
});

const lightBrief = {
  gender: 'male',
  ageMin: 25,
  ageMax: 30,
  shootDate: '2026-12-01',
};

test('성별이 다르면 20점을 받지 못한다', () => {
  const matched = scoreActor(actor, lightBrief, YEAR);
  const mismatched = scoreActor({ ...actor, gender: 'female' }, lightBrief, YEAR);
  assert.equal(matched.score - mismatched.score, 20);
  assert.ok(!mismatched.reasons.includes('성별 조건 부합'));
});

test('촬영일이 불가일과 겹치면 25점 감점되고 사유가 붙는다', () => {
  const blocked = scoreActor(actor, { ...lightBrief, shootDate: '2026-11-20' }, YEAR);
  const free = scoreActor(actor, lightBrief, YEAR);
  assert.equal(free.score - blocked.score, 30); // +5 일정 가점 대신 -25
  assert.ok(blocked.reasons.includes('출연 불가일과 촬영일 겹침'));
  assert.ok(!blocked.reasons.includes('촬영 일정 문제없음'));
});

test('점수는 0~95 사이로 클램프된다', () => {
  assert.equal(scoreActor(actor, fullBrief, YEAR).score, 95);
  const nothing = scoreActor(actor, {}, YEAR);
  assert.equal(nothing.score, 0);
  assert.deepEqual(nothing.reasons, []);
  const penalty = scoreActor(
    { ...actor, gender: 'female', region: '부산', tags: [], skills: [], intro: '' },
    { gender: 'male', shootDate: '2026-11-20' },
    YEAR,
  );
  assert.equal(penalty.score, 0); // 음수도 0 아래로 내려가지 않는다
});

test('한국 나이는 현재 연도 - 출생 연도 + 1로 계산한다', () => {
  assert.equal(koreanAge(1999, YEAR), 28);
  assert.equal(koreanAge(null, YEAR), null);
});

test('연령·키 범위를 벗어나면 해당 가점이 없다', () => {
  const result = scoreActor(actor, { ageMin: 40, heightMax: 170 }, YEAR);
  assert.equal(result.score, 0);
  assert.ok(!result.reasons.includes('연령 조건 부합'));
  assert.ok(!result.reasons.includes('키 조건 부합'));
});

test('여러 촬영일 중 하루라도 불가일이면 감점하고 겹친 날 수를 알려 준다', () => {
  const brief = { ...lightBrief, shootDates: ['2026-11-19', '2026-11-20', '2026-11-21'] };
  const { reasons } = scoreActor(actor, brief, YEAR);
  assert.ok(reasons.includes('출연 불가일과 촬영일 겹침 (1일)'));
  const free = scoreActor(actor, { ...lightBrief, shootDates: ['2026-11-21'] }, YEAR);
  assert.ok(free.reasons.includes('촬영 일정 문제없음'));
});
