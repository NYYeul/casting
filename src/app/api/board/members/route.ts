import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { addMember, isBoardOwner, projectExists } from '@/lib/board';
import { requiredText, validEmail } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = requiredText(body.projectId, 60);
  const email = requiredText(body.email, 254).toLowerCase();
  if (!(await projectExists(projectId)))
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  if (!(await isBoardOwner(projectId, userId)))
    return NextResponse.json(
      { error: '프로젝트 소유자만 팀원을 초대할 수 있습니다.' },
      { status: 403 },
    );
  if (!validEmail(email))
    return NextResponse.json({ error: '가입된 제작자 이메일이 아닙니다.' }, { status: 404 });
  const user = await addMember(projectId, email);
  if (!user)
    return NextResponse.json({ error: '가입된 제작자 이메일이 아닙니다.' }, { status: 404 });
  return NextResponse.json(
    { member: { userId: user.id, name: user.name, role: 'member' as const } },
    { status: 201 },
  );
}
