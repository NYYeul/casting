import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 32;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string) {
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (password.length > 128) return '비밀번호가 너무 깁니다.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  return '';
}
