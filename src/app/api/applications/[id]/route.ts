import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { applicationOwnedBy, reviewApplication } from '@/lib/db';
import type { PublicStage, ReviewStatus } from '@/lib/types';
import { requiredText } from '@/lib/validation';

const statuses: ReviewStatus[] = ['new', 'reviewing', 'hold', 'interested', 'excluded'];
const publicStages: PublicStage[] = ['received', 'audition', 'not_selected', 'cast'];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  if (!applicationOwnedBy(id, producerId))
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
  const application = reviewApplication(id, input);
  return application
    ? NextResponse.json({ application })
    : NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
}
