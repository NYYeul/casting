import { notFound, redirect } from 'next/navigation';
import { getProfile, listFavoriteIds, listProducerProposals } from '@/lib/accounts';
import { getSession } from '@/lib/auth';
import { listRoles } from '@/lib/db';
import ActorDetail from './actor-detail';

export const dynamic = 'force-dynamic';

export default async function ActorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/actors/${id}`);
  const isSelf = session.role === 'actor' && session.userId === id;
  if (session.role !== 'producer' && !isSelf) notFound();
  const profile = getProfile(id);
  if (!profile || (!profile.isPublic && !isSelf)) notFound();
  const producer = session.role === 'producer';
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActorDetail
      profile={profile}
      viewer={producer ? 'producer' : 'self'}
      favorite={producer && listFavoriteIds(session.userId).includes(id)}
      roles={
        producer
          ? listRoles(session.userId)
              .filter((role) => !role.isClosed && role.deadline >= today)
              .map((role) => ({ id: role.id, label: `${role.projectTitle} · ${role.title}` }))
          : []
      }
      proposedRoleIds={
        producer ? listProducerProposals(session.userId, id).map((p) => p.roleId) : []
      }
    />
  );
}
