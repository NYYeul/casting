import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import ProjectWizard from '../../new/project-wizard';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: Context) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio');
  if (user.role !== 'producer') redirect('/me');
  const { id } = await params;
  const row = (await db().prepare('SELECT * FROM projects WHERE id=?').get(id)) as
    Record<string, unknown> | undefined;
  if (!row) notFound();
  if (String(row.owner_id) !== user.id) {
    return (
      <main className="app-shell">
        <div className="screen-pad page-top">
          <Link className="back-link" href="/studio">
            ‹ 프로젝트
          </Link>
          <div className="empty-card">
            프로젝트를 수정할 권한이 없습니다.
            <br />
            소유한 프로젝트만 수정할 수 있습니다.
          </div>
        </div>
      </main>
    );
  }
  return (
    <ProjectWizard
      contactName={user.orgName || user.name}
      editId={id}
      initial={{
        title: String(row.title),
        genre: String(row.genre),
        shootStart: String(row.shoot_start),
        shootEnd: String(row.shoot_end),
        location: String(row.location),
        description: String(row.description),
      }}
    />
  );
}
