import { NextRequest, NextResponse } from 'next/server';
import { createProjectWithRoles, listProjects, type Project } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { db } from '@/lib/db';
import { requiredText } from '@/lib/validation';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Row = Record<string, unknown>;

function projectFromRow(row: Row): Project {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title),
    genre: String(row.genre),
    shootStart: String(row.shoot_start),
    shootEnd: String(row.shoot_end),
    location: String(row.location),
    description: String(row.description),
    createdAt: String(row.created_at),
  };
}

async function getProjectRow(id: string) {
  return (await db().prepare('SELECT * FROM projects WHERE id=?').get(id)) as Row | undefined;
}

export async function GET() {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  return NextResponse.json({ projects: await listProjects(producerId) });
}

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const project = {
    title: requiredText(body.title, 100),
    genre: requiredText(body.genre, 40),
    shootStart: requiredText(body.shootStart, 10),
    shootEnd: requiredText(body.shootEnd, 10),
    location: requiredText(body.location, 100),
    description: requiredText(body.description, 2000),
  };
  const deadline = requiredText(body.deadline, 10);
  const announcementDate = requiredText(body.announcementDate, 10);
  const pay = requiredText(body.pay, 100);
  const contactName = requiredText(body.contactName, 100);
  if (!project.title || !project.location || !DATE.test(project.shootStart))
    return NextResponse.json(
      { error: '작품명, 촬영 시작일, 지역을 입력해 주세요.' },
      { status: 400 },
    );
  if (project.shootEnd && (!DATE.test(project.shootEnd) || project.shootEnd < project.shootStart))
    return NextResponse.json({ error: '촬영 종료일을 확인해 주세요.' }, { status: 400 });
  if (!DATE.test(deadline) || !DATE.test(announcementDate) || !pay || !contactName)
    return NextResponse.json(
      { error: '지원 마감일, 결과 안내일, 출연료, 담당자를 입력해 주세요.' },
      { status: 400 },
    );
  const roles = (Array.isArray(body.roles) ? body.roles : [])
    .map((role: Record<string, unknown>) => ({
      title: requiredText(role?.title, 100),
      description: requiredText(role?.description, 2000),
      requirement: requiredText(role?.requirement, 500),
    }))
    .filter((role: { title: string; description: string }) => role.title && role.description)
    .slice(0, 20);
  if (roles.length === 0)
    return NextResponse.json({ error: '배역을 하나 이상 추가해 주세요.' }, { status: 400 });
  const created = await createProjectWithRoles(
    producerId,
    { ...project, shootEnd: project.shootEnd || project.shootStart },
    roles.map((role: { title: string; description: string; requirement: string }) => ({
      ...role,
      shootDate: project.shootStart,
      location: project.location,
      pay,
      deadline,
      contactName,
      announcementDate,
    })),
  );
  return NextResponse.json(created, { status: 201 });
}

/**
 * 프로젝트 부분 수정 (owner만). PATCH /api/projects
 * body: {id, title?, genre?, shootStart?, shootEnd?, location?, description?}
 * roles·지원 조건은 범위 밖(지원 링크 관리에서 수정).
 */
export async function PATCH(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = requiredText(body.id, 60);
  if (!id) return NextResponse.json({ error: '프로젝트 id가 필요합니다.' }, { status: 400 });
  const row = await getProjectRow(id);
  if (!row) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  if (String(row.owner_id) !== producerId)
    return NextResponse.json({ error: '프로젝트를 수정할 권한이 없습니다.' }, { status: 403 });

  const patch: Partial<
    Pick<Project, 'title' | 'genre' | 'shootStart' | 'shootEnd' | 'location' | 'description'>
  > = {};
  if (body.title !== undefined) {
    patch.title = requiredText(body.title, 100);
    if (!patch.title)
      return NextResponse.json({ error: '작품명을 입력해 주세요.' }, { status: 400 });
  }
  if (body.genre !== undefined) patch.genre = requiredText(body.genre, 40);
  if (body.location !== undefined) {
    patch.location = requiredText(body.location, 100);
    if (!patch.location)
      return NextResponse.json({ error: '촬영 지역을 입력해 주세요.' }, { status: 400 });
  }
  if (body.description !== undefined) patch.description = requiredText(body.description, 2000);
  if (body.shootStart !== undefined) {
    patch.shootStart = requiredText(body.shootStart, 10);
    if (!DATE.test(patch.shootStart))
      return NextResponse.json({ error: '촬영 시작일을 확인해 주세요.' }, { status: 400 });
  }
  if (body.shootEnd !== undefined) {
    patch.shootEnd = requiredText(body.shootEnd, 10);
    if (patch.shootEnd && !DATE.test(patch.shootEnd))
      return NextResponse.json({ error: '촬영 종료일을 확인해 주세요.' }, { status: 400 });
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 });

  // POST와 동일 규칙: shootEnd는 생략·빈 값이면 shootStart와 동일하게, 존재하면 shootStart 이후여야 함
  const shootStart = patch.shootStart ?? String(row.shoot_start);
  const shootEnd =
    patch.shootEnd !== undefined ? patch.shootEnd || shootStart : String(row.shoot_end);
  if (shootEnd && shootEnd < shootStart)
    return NextResponse.json({ error: '촬영 종료일을 확인해 주세요.' }, { status: 400 });

  await db()
    .prepare(
      `UPDATE projects SET title=?,genre=?,shoot_start=?,shoot_end=?,location=?,description=?
      WHERE id=?`,
    )
    .run(
      patch.title ?? String(row.title),
      patch.genre ?? String(row.genre),
      shootStart,
      shootEnd,
      patch.location ?? String(row.location),
      patch.description ?? String(row.description),
      id,
    );
  return NextResponse.json({ project: projectFromRow((await getProjectRow(id))!) });
}
