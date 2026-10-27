import { cookies } from 'next/headers';
import { getUserById } from './accounts';
import { createSessionToken, readSessionToken, type Session } from './session-token';

const COOKIE = 'cs_session';

function secret() {
  return process.env.SESSION_SECRET || '';
}

export function hasSetup() {
  return secret().length >= 24;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = token ? readSessionToken(token, secret()) : null;
  return session && (await getUserById(session.userId)) ? session : null;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session ? await getUserById(session.userId) : null;
}

export async function getProducerId() {
  const session = await getSession();
  return session?.role === 'producer' ? session.userId : null;
}

export async function getActorId() {
  const session = await getSession();
  return session?.role === 'actor' ? session.userId : null;
}

export async function startSession(session: Session) {
  (await cookies()).set(COOKIE, createSessionToken(session, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export function homeFor(role: Session['role']) {
  return role === 'producer' ? '/studio' : '/me';
}
