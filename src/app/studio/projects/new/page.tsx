import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ProjectWizard from './project-wizard';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio/projects/new');
  if (user.role !== 'producer') redirect('/me');
  return <ProjectWizard contactName={user.orgName || user.name} />;
}
