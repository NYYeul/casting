import { NextRequest, NextResponse } from 'next/server';
import { createProjectWithRoles, listProjects } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { requiredText } from '@/lib/validation';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  return NextResponse.json({ projects: listProjects(producerId) });
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
  const created = createProjectWithRoles(
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
