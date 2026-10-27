import { NextRequest, NextResponse } from 'next/server';
import { deleteAccount, getUserWithHash } from '@/lib/accounts';
import { endSession, getCurrentUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

// 회원 탈퇴. 본인 확인을 위해 비밀번호를 다시 받는다.
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (user.email.endsWith('@demo.casting'))
    return NextResponse.json({ error: '체험 계정은 탈퇴할 수 없습니다.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const found = await getUserWithHash(user.email);
  if (!found || !verifyPassword(String(body.password || ''), found.passwordHash))
    return NextResponse.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
  await deleteAccount(user.id);
  await endSession();
  return NextResponse.json({ ok: true });
}
