import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/accounts';
import { getCurrentUser } from '@/lib/auth';
import ProfileEditor from './profile-editor';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me/profile');
  if (user.role !== 'actor') redirect('/studio');
  const profile = getProfile(user.id);
  if (!profile) redirect('/me');
  return <ProfileEditor initial={profile} />;
}
