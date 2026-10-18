import { NextRequest, NextResponse } from 'next/server';
import { getUserWithHash } from '@/lib/accounts';
import { endSession, hasSetup, homeFor, startSession } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  if (!hasSetup())
    return NextResponse.json({ error: 'SESSION_SECRET이 설정되지 않았습니다.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const found = getUserWithHash(requiredText(body.email, 254));
  if (!found || !verifyPassword(String(body.password || ''), found.passwordHash))
    return NextResponse.json({ error: '이메일 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  await startSession({ userId: found.user.id, role: found.user.role });
  return NextResponse.json({ ok: true, role: found.user.role, next: homeFor(found.user.role) });
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
