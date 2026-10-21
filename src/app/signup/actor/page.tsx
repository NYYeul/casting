import { redirect } from 'next/navigation';
import SignupWizard from '@/components/signup-wizard';
import { getSession, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  if (process.env.DEMO_MODE === 'true') redirect('/login');
  return <SignupWizard role="actor" />;
}
