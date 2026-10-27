import { NextRequest, NextResponse } from 'next/server';
import { getUserWithHash } from '@/lib/accounts';
import { endSession, hasSetup, homeFor, startSession } from '@/lib/auth';
import { claimApplications } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  if (!hasSetup())
    return NextResponse.json({ error: 'SESSION_SECRET이 설정되지 않았습니다.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const found = await getUserWithHash(requiredText(body.email, 254));
  if (!found || !verifyPassword(String(body.password || ''), found.passwordHash))
    return NextResponse.json({ error: '이메일 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  await startSession({ userId: found.user.id, role: found.user.role });
  // 로그아웃 상태로 낸 지원서를 이 계정에 붙인다 ('내 지원 현황'에서 다시 찾을 수 있도록)
  if (found.user.role === 'actor') await claimApplications(found.user.id, found.user.email);
  return NextResponse.json({ ok: true, role: found.user.role, next: homeFor(found.user.role) });
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
