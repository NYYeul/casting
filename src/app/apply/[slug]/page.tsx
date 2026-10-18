import { notFound } from 'next/navigation';
import { getProfile, getUserById } from '@/lib/accounts';
import { getActorId } from '@/lib/auth';
import { getRole } from '@/lib/db';
import { ageOf } from '@/lib/profile';
import ApplyForm, { type Prefill } from './apply-form';

export const dynamic = 'force-dynamic';

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ proposal?: string }>;
}) {
  const { slug } = await params;
  const { proposal } = await searchParams;
  const role = getRole(slug);
  if (!role) notFound();
  const actorId = await getActorId();
  let prefill: Prefill | null = null;
  if (actorId) {
    const user = getUserById(actorId);
    const profile = getProfile(actorId);
    if (user && profile)
      prefill = {
        name: profile.name,
        email: user.email,
        phone: user.phone,
        age: ageOf(profile.birthYear),
        introduction: [
          profile.intro,
          ...profile.filmography.map((f) => `${f.year} ${f.title} ${f.role}`),
        ]
          .filter(Boolean)
          .join('\n'),
        photoUrl: profile.photos[0] || '',
        videoUrl: profile.videoUrl,
        skill: profile.skills.join(', '),
        unavailable: profile.unavailableDates.includes(role.shootDate),
      };
  }
  return (
    <ApplyForm
      role={role}
      prefill={prefill}
      proposalId={actorId && proposal && /^[\w-]{8,60}$/.test(proposal) ? proposal : ''}
    />
  );
}
