import { NextRequest, NextResponse } from 'next/server';
import { setProposalStatus } from '@/lib/accounts';
import { getActorId } from '@/lib/auth';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (body.status !== 'declined')
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 });
  return setProposalStatus(id, actorId, 'declined')
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: '처리할 수 없는 제안입니다.' }, { status: 409 });
}
