import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import CompareClient from './compare-client';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/compare');
  if (session.role !== 'producer') redirect('/me');
  return <CompareClient />;
}
