import { NextRequest, NextResponse } from 'next/server';
import { getProfile, getUserById } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import {
  addCandidate,
  findCandidate,
  getCandidate,
  getCandidateCard,
  isBoardMember,
  isBoardOwner,
  projectExists,
  removeCandidate,
} from '@/lib/board';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = requiredText(body.projectId, 60);
  const actorId = requiredText(body.actorId, 60);
  if (!(await projectExists(projectId)))
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  if (!(await isBoardMember(projectId, userId)))
    return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
  const actor = await getUserById(actorId);
  const profile = actor?.role === 'actor' ? await getProfile(actorId) : null;
  if (!actor || actor.role !== 'actor' || !profile?.isPublic)
    return NextResponse.json(
      { error: '공개 프로필의 가입 배우만 후보로 추가할 수 있습니다.' },
      { status: 404 },
    );
  const existing = await findCandidate(projectId, actorId);
  if (existing)
    return NextResponse.json({
      candidate: await getCandidateCard(existing.id),
      duplicated: true,
    });
  const created = await addCandidate(projectId, actorId, userId);
  return NextResponse.json({ candidate: await getCandidateCard(created.id) }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id')?.trim() || '';
  const candidate = await getCandidate(id);
  if (!candidate) return NextResponse.json({ error: '후보를 찾을 수 없습니다.' }, { status: 404 });
  if (!(await isBoardOwner(candidate.project_id, userId)) && candidate.added_by !== userId)
    return NextResponse.json(
      { error: '프로젝트 소유자나 후보를 추가한 본인만 제거할 수 있습니다.' },
      { status: 403 },
    );
  await removeCandidate(id);
  return NextResponse.json({ ok: true });
}
