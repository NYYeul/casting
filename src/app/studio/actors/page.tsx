import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ActorSearch from './actor-search';

export const dynamic = 'force-dynamic';

export default async function ActorsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/actors');
  if (session.role !== 'producer') redirect('/me');
  return <ActorSearch />;
}
