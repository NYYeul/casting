import { NextRequest, NextResponse } from 'next/server';
import { applicationBoardAccess } from '@/lib/board';
import { getProducerId } from '@/lib/auth';
import { applicationOwnedBy, getApplication, reviewApplication } from '@/lib/db';
import type { PublicStage, ReviewStatus } from '@/lib/types';
import { requiredText } from '@/lib/validation';

const statuses: ReviewStatus[] = ['new', 'reviewing', 'hold', 'interested', 'excluded'];
const publicStages: PublicStage[] = ['received', 'audition', 'not_selected', 'cast'];

/**
 * 지원서 한 건의 상세. 팀 보드에서 카드를 떠나지 않고 내용을 보려고 쓴다.
 * 배역 담당자뿐 아니라 그 프로젝트 보드에 초대된 팀원도 볼 수 있어야 해서
 * 소유자 확인 대신 보드 접근 권한을 쓴다.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  const access = await applicationBoardAccess(id, userId);
  if (access === 'missing')
    return NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
  if (access === 'denied')
    return NextResponse.json({ error: '볼 권한이 없습니다.' }, { status: 403 });
  const application = await getApplication(id);
  return application
    ? NextResponse.json({ application }, { headers: { 'Cache-Control': 'private, no-store' } })
    : NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await applicationOwnedBy(id, producerId)))
    return NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const input: {
    status?: ReviewStatus;
    note?: string;
    shortlist?: boolean;
    publicStage?: PublicStage;
  } = {};
  if ('status' in body) {
    if (!statuses.includes(body.status))
      return NextResponse.json({ error: '검토 상태가 올바르지 않습니다.' }, { status: 400 });
    input.status = body.status;
  }
  if ('note' in body) input.note = requiredText(body.note, 2000);
  if ('shortlist' in body) {
    if (typeof body.shortlist !== 'boolean')
      return NextResponse.json({ error: '후보 선택 값이 올바르지 않습니다.' }, { status: 400 });
    input.shortlist = body.shortlist;
  }
  if ('publicStage' in body) {
    if (!publicStages.includes(body.publicStage))
      return NextResponse.json({ error: '공개 상태가 올바르지 않습니다.' }, { status: 400 });
    input.publicStage = body.publicStage;
  }
  const application = await reviewApplication(id, input);
  return application
    ? NextResponse.json({ application })
    : NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
}
