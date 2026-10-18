import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import BoardClient from './board-client';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/board');
  if (session.role !== 'producer') redirect('/me');
  return <BoardClient meId={session.userId} />;
}
