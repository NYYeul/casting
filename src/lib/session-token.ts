import { createHmac, timingSafeEqual } from 'node:crypto';

export type UserRole = 'producer' | 'actor';
export type Session = { userId: string; role: UserRole };

const WEEK = 1000 * 60 * 60 * 24 * 7;

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSessionToken(session: Session, secret: string, now = Date.now()) {
  const payload = `${session.userId}.${session.role}.${now + WEEK}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string, secret: string, now = Date.now()): Session | null {
  const parts = token.split('.');
  if (parts.length !== 4 || secret.length < 24) return null;
  const [userId, role, expires, signature] = parts;
  if (role !== 'producer' && role !== 'actor') return null;
  if (!/^[\w-]{8,64}$/.test(userId) || Number(expires) < now) return null;
  const expected = Buffer.from(sign(`${userId}.${role}.${expires}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { userId, role };
}
