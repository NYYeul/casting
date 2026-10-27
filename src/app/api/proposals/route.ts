import { NextRequest, NextResponse } from 'next/server';
import { createProposal } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const message = requiredText(body.message, 1000);
  if (!message)
    return NextResponse.json({ error: '제안 메시지를 입력해 주세요.' }, { status: 400 });
  const result = await createProposal(
    producerId,
    requiredText(body.actorId, 60),
    requiredText(body.roleId, 60),
    message,
  );
  return 'error' in result
    ? NextResponse.json({ error: result.error }, { status: 400 })
    : NextResponse.json({ proposal: result.proposal }, { status: 201 });
}
