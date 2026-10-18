import { NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { listUpcomingAuditions } from '@/lib/db';

function nowKst() {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 16);
}

export async function GET() {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  return NextResponse.json(
    { auditions: listUpcomingAuditions(producerId, nowKst()) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
