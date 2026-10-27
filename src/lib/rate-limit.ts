// DB 기반의 간단한 고정 창(fixed window) 시도 횟수 제한.
// 서버리스 인스턴스가 여러 개여도 같은 Postgres를 보므로 횟수가 공유된다.

import { db } from './db';

export function clientIp(headers: Headers) {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}

/** 이번 시도를 세고, 창 안에서 limit을 넘었으면 true를 돌려준다. */
export async function overLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const expired = now - windowSeconds * 1000;
  const row = (await db()
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < ? THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < ? THEN EXCLUDED.window_start
                        ELSE rate_limits.window_start END
       RETURNING count`,
    )
    .get(key, now, expired, expired)) as { count: number } | undefined;
  return Number(row?.count ?? 0) > limit;
}

export const TOO_MANY = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
