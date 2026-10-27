import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_SPECIAL_SCENE,
  normalizeSpecialScenes,
  specialScenesLabel,
} from '../src/lib/project-meta.ts';
import { actorStageInfo, actorStageOf } from '../src/lib/types.ts';

test('특수 장면: 종류를 고르면 "없음"은 빠지고, 모르는 값은 버린다', () => {
  assert.deepEqual(normalizeSpecialScenes(['none', 'nudity', 'hack', 'nudity']), ['nudity']);
  assert.deepEqual(normalizeSpecialScenes(['none']), [NO_SPECIAL_SCENE]);
  // 아무것도 안 고르면 '아직 안내 안 함'(빈 목록)
  assert.deepEqual(normalizeSpecialScenes([]), []);
  assert.deepEqual(normalizeSpecialScenes('nudity'), []);
});

test('특수 장면 표시', () => {
  assert.equal(specialScenesLabel(['none']), '특수 장면 없음');
  assert.equal(specialScenesLabel(['nudity', 'smoking']), '노출·흡연·음주');
  assert.equal(specialScenesLabel([]), '');
});

test('지원 현황: 결과 전에는 열람 여부로 미열람·검토 중을 나눈다', () => {
  assert.equal(actorStageOf({ publicStage: 'received', viewedAt: null }), 'unread');
  assert.equal(
    actorStageOf({ publicStage: 'received', viewedAt: '2026-10-27T10:00:00Z' }),
    'reviewing',
  );
  assert.equal(actorStageInfo.unread.label, '미열람');
  assert.equal(actorStageInfo.reviewing.label, '검토 중');
});

test('지원 현황: 결과가 정해지면 열람 여부와 상관없이 그 결과를 보여 준다', () => {
  assert.equal(actorStageOf({ publicStage: 'audition', viewedAt: null }), 'audition');
  assert.equal(actorStageOf({ publicStage: 'cast', viewedAt: 'x' }), 'cast');
  assert.equal(actorStageOf({ publicStage: 'not_selected', viewedAt: 'x' }), 'not_selected');
  assert.equal(actorStageInfo.cast.label, '합격');
  assert.equal(actorStageInfo.not_selected.label, '불합격');
});
