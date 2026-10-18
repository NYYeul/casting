import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import {
  applicationBoardAccess,
  candidateBoardAccess,
  toggleCandidateVote,
  toggleVote,
} from '@/lib/board';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const applicationId = requiredText(body.applicationId, 60);
  const candidateId = requiredText(body.candidateId, 60);
  if (applicationId && candidateId)
    return NextResponse.json({ error: '지원서와 후보 중 하나만 지정해 주세요.' }, { status: 400 });
  if (candidateId) {
    const access = candidateBoardAccess(candidateId, userId);
    if (access === 'missing')
      return NextResponse.json({ error: '후보를 찾을 수 없습니다.' }, { status: 404 });
    if (access === 'denied')
      return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
    return NextResponse.json(toggleCandidateVote(candidateId, userId));
  }
  const access = applicationBoardAccess(applicationId, userId);
  if (access === 'missing')
    return NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
  if (access === 'denied')
    return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
  const result = toggleVote(applicationId, userId);
  return NextResponse.json(result);
}
