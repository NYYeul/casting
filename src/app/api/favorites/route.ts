import { NextRequest, NextResponse } from 'next/server';
import { getUserById, setFavorite } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const actorId = requiredText(body.actorId, 60);
  if (getUserById(actorId)?.role !== 'actor')
    return NextResponse.json({ error: '배우를 찾을 수 없습니다.' }, { status: 404 });
  setFavorite(producerId, actorId, body.favorite !== false);
  return NextResponse.json({ ok: true, favorite: body.favorite !== false });
}
