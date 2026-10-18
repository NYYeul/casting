import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, passwordProblem, verifyPassword } from '../src/lib/password.ts';
import { createSessionToken, readSessionToken } from '../src/lib/session-token.ts';
import { matchesFilters, profileCompletion, cleanList, IMAGE_TAGS } from '../src/lib/profile.ts';
import { embedUrl } from '../src/lib/video.ts';
import { safeImageRef } from '../src/lib/validation.ts';

const SECRET = 'x'.repeat(32);

test('비밀번호는 해시로 저장되고 같은 값만 통과한다', () => {
  const stored = hashPassword('casting2026');
  assert.notEqual(stored, 'casting2026');
  assert.equal(verifyPassword('casting2026', stored), true);
  assert.equal(verifyPassword('casting2027', stored), false);
  assert.equal(verifyPassword('casting2026', 'plain'), false);
  assert.notEqual(hashPassword('casting2026'), stored);
});

test('비밀번호 규칙: 8자 이상, 영문과 숫자 포함', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletters'));
  assert.equal(passwordProblem('letters123'), '');
});

test('세션 토큰은 서명·역할·만료를 검증한다', () => {
  const session = { userId: '5b0c1c3e-1111-2222-3333-444455556666', role: 'producer' };
  const token = createSessionToken(session, SECRET, 1000);
  assert.deepEqual(readSessionToken(token, SECRET, 2000), session);
  assert.equal(readSessionToken(token, 'y'.repeat(32), 2000), null);
  assert.equal(readSessionToken(token.replace('.producer.', '.actor.'), SECRET, 2000), null);
  assert.equal(readSessionToken(token, SECRET, 1000 + 8 * 24 * 3600 * 1000), null);
  assert.equal(readSessionToken(token, 'short', 2000), null);
});

const base = {
  userId: 'a1',
  name: '김도윤',
  gender: 'male',
  birthYear: 2000,
  height: 181,
  weight: 70,
  region: '서울',
  intro: '단편영화 3편 주연, 담백한 감정 연기를 좋아합니다.',
  tags: ['소년미'],
  skills: ['영어'],
  photos: ['a', 'b', 'c'],
  videoUrl: 'https://youtu.be/abcdefg',
  filmography: [{ year: '2025', title: '봄날', role: '주연' }],
  unavailableDates: ['2026-10-26'],
  isPublic: true,
  updatedAt: '',
};

test('프로필 완성도는 채운 항목 비율로 계산한다', () => {
  assert.equal(profileCompletion(base), 100);
  assert.equal(profileCompletion({ ...base, photos: ['a'], videoUrl: '' }), 83);
  assert.equal(
    profileCompletion({
      ...base,
      gender: '',
      birthYear: null,
      height: null,
      region: '',
      intro: '',
      tags: [],
      skills: [],
      photos: [],
      videoUrl: '',
      filmography: [],
    }),
    8,
  );
});

test('배우 검색 필터: 성별·연령·키·지역·특기·태그·불가일', () => {
  const year = 2026;
  assert.equal(matchesFilters(base, { gender: 'male', ageMin: 20, ageMax: 29 }, year), true);
  assert.equal(matchesFilters(base, { gender: 'female' }, year), false);
  assert.equal(matchesFilters(base, { ageMin: 30 }, year), false);
  assert.equal(matchesFilters(base, { heightMin: 182 }, year), false);
  assert.equal(matchesFilters(base, { region: '부산' }, year), false);
  assert.equal(matchesFilters(base, { skill: '영어', tag: '소년미' }, year), true);
  assert.equal(matchesFilters(base, { available: '2026-10-26' }, year), false);
  assert.equal(matchesFilters(base, { available: '2026-10-27' }, year), true);
  assert.equal(matchesFilters(base, { q: '감정' }, year), true);
  assert.equal(matchesFilters({ ...base, height: null }, { heightMin: 150 }, year), false);
});

test('태그 목록은 허용 값만, 중복 없이, 최대 개수까지', () => {
  assert.deepEqual(cleanList(['청순한', '청순한', '해킹', 3, '시크한'], IMAGE_TAGS, 5), [
    '청순한',
    '시크한',
  ]);
  assert.equal(cleanList(IMAGE_TAGS, IMAGE_TAGS, 5).length, 5);
});

test('영상 링크는 YouTube·Vimeo만 임베드로 바꾼다', () => {
  assert.equal(
    embedUrl('https://www.youtube.com/watch?v=ScMzIvxBSi4'),
    'https://www.youtube-nocookie.com/embed/ScMzIvxBSi4',
  );
  assert.equal(
    embedUrl('https://youtu.be/ScMzIvxBSi4?t=3'),
    'https://www.youtube-nocookie.com/embed/ScMzIvxBSi4',
  );
  assert.equal(embedUrl('https://vimeo.com/123456'), 'https://player.vimeo.com/video/123456');
  assert.equal(embedUrl('https://example.com/video.mp4'), null);
  assert.equal(embedUrl('not a url'), null);
});

test('사진 경로는 업로드 경로나 http(s)만 허용한다', () => {
  assert.equal(
    safeImageRef('/api/uploads/0b9f6c1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg'),
    '/api/uploads/0b9f6c1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg',
  );
  assert.equal(safeImageRef('/api/uploads/../../etc/passwd'), '');
  assert.equal(safeImageRef('javascript:alert(1)'), '');
});
