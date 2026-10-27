import { NextRequest, NextResponse } from 'next/server';
import { passwordProblem } from '@/lib/password';
import { consumeResetToken } from '@/lib/password-reset';
import { clientIp, overLimit, TOO_MANY } from '@/lib/rate-limit';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  if (await overLimit(`reset-confirm-ip:${clientIp(request.headers)}`, 20, 3600))
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const token = requiredText(body.token, 100);
  const password = String(body.password || '');
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (!token || !(await consumeResetToken(token, password)))
    return NextResponse.json(
      { error: '링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.' },
      { status: 400 },
    );
  return NextResponse.json({ ok: true });
}
