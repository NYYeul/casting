import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserWithHash } from '@/lib/accounts';
import { hasSetup, homeFor, startSession } from '@/lib/auth';
import { claimApplications } from '@/lib/db';
import { passwordProblem } from '@/lib/password';
import { requiredText, validEmail } from '@/lib/validation';

export async function POST(request: NextRequest) {
  if (!hasSetup())
    return NextResponse.json({ error: 'SESSION_SECRET이 설정되지 않았습니다.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const role = body.role === 'producer' ? 'producer' : body.role === 'actor' ? 'actor' : null;
  const email = requiredText(body.email, 254).toLowerCase();
  const password = String(body.password || '');
  const name = requiredText(body.name, 60);
  const phone = requiredText(body.phone, 30);
  if (!role) return NextResponse.json({ error: '역할을 선택해 주세요.' }, { status: 400 });
  if (!name || !validEmail(email))
    return NextResponse.json({ error: '이름과 이메일을 확인해 주세요.' }, { status: 400 });
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (body.agreeTerms !== true || body.agreePrivacy !== true)
    return NextResponse.json({ error: '필수 약관에 동의해 주세요.' }, { status: 400 });
  if (role === 'producer' && !requiredText(body.orgType, 40))
    return NextResponse.json({ error: '소속 유형을 선택해 주세요.' }, { status: 400 });
  if (getUserWithHash(email))
    return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 });
  const user = createUser({
    email,
    password,
    role,
    name,
    phone,
    orgType: requiredText(body.orgType, 40),
    orgName: requiredText(body.orgName, 100),
  });
  await startSession({ userId: user.id, role: user.role });
  // 가입 전에 같은 이메일로 낸 지원서가 있으면 새 계정에 붙인다
  if (role === 'actor') claimApplications(user.id, email);
  return NextResponse.json(
    { ok: true, next: role === 'actor' ? '/me/profile' : homeFor(role) },
    { status: 201 },
  );
}
