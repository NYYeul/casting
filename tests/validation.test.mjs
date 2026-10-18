import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, validEmail } from '../src/lib/validation.ts';

test('연기 자료 링크는 http(s)만 허용한다', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('file:///private/profile.pdf'), '');
  assert.equal(safeUrl('https://example.com/showreel'), 'https://example.com/showreel');
});

test('지원 이메일의 기본 형식을 확인한다', () => {
  assert.equal(validEmail('actor@example.com'), true);
  assert.equal(validEmail('not-an-email'), false);
});
