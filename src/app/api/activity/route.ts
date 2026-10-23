import { NextResponse } from 'next/server';
import { actorFeed, producerFeed } from '@/lib/activity';
import { getProfile } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const feed =
    user.role === 'producer'
      ? producerFeed(user.id)
      : actorFeed(user.id, user.role === 'actor' ? getProfile(user.id) : null);
  return NextResponse.json(feed);
}
