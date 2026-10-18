import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import RecommendClient from './recommend-client';

export const dynamic = 'force-dynamic';

export default async function RecommendPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/recommend');
  if (session.role !== 'producer') redirect('/me');
  return <RecommendClient />;
}
