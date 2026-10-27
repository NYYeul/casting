// 비밀번호 재설정: 메일로 1회용 링크를 보내고, 링크의 토큰으로 새 비밀번호를 받는다.

import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { hashPassword } from './password';
import { transaction } from './sql';

const TTL_MINUTES = 30;

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

/** 새 토큰을 만들어 원문을 돌려준다. 원문은 메일 링크에만 담긴다. */
export async function createResetToken(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_MINUTES * 60_000);
  await db()
    .prepare(
      'INSERT INTO password_resets (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)',
    )
    .run(digest(token), userId, expires.toISOString(), now.toISOString());
  return token;
}

/** 토큰이 유효하면 비밀번호를 바꾸고 그 사용자의 재설정 토큰을 모두 무효화한다. */
export async function consumeResetToken(token: string, password: string) {
  return transaction(async () => {
    const row = (await db()
      .prepare(
        'SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash=? FOR UPDATE',
      )
      .get(digest(token))) as
      { user_id: string; expires_at: string; used_at: string | null } | undefined;
    if (!row || row.used_at || row.expires_at < new Date().toISOString()) return null;
    await db()
      .prepare('UPDATE users SET password_hash=? WHERE id=?')
      .run(hashPassword(password), row.user_id);
    await db()
      .prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL')
      .run(new Date().toISOString(), row.user_id);
    return row.user_id;
  });
}

export const RESET_TTL_MINUTES = TTL_MINUTES;
