import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import {
  addCandidateNote,
  addNote,
  applicationBoardAccess,
  candidateBoardAccess,
  deleteStoredNote,
  getAnyNote,
  noteBoardAccess,
  updateNoteBody,
} from '@/lib/board';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const applicationId = requiredText(body.applicationId, 60);
  const candidateId = requiredText(body.candidateId, 60);
  const text = requiredText(body.body, 500);
  if (!text) return NextResponse.json({ error: '메모 내용을 입력해 주세요.' }, { status: 400 });
  if (applicationId && candidateId)
    return NextResponse.json({ error: '지원서와 후보 중 하나만 지정해 주세요.' }, { status: 400 });
  if (candidateId) {
    const access = candidateBoardAccess(candidateId, userId);
    if (access === 'missing')
      return NextResponse.json({ error: '후보를 찾을 수 없습니다.' }, { status: 404 });
    if (access === 'denied')
      return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
    const note = addCandidateNote(randomUUID(), candidateId, userId, text);
    return NextResponse.json({ note }, { status: 201 });
  }
  const access = applicationBoardAccess(applicationId, userId);
  if (access === 'missing')
    return NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
  if (access === 'denied')
    return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
  const note = addNote(randomUUID(), applicationId, userId, text);
  return NextResponse.json({ note }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = requiredText(body.id, 60);
  const text = requiredText(body.body, 500);
  const note = getAnyNote(id);
  if (!note) return NextResponse.json({ error: '메모를 찾을 수 없습니다.' }, { status: 404 });
  const access = noteBoardAccess(note, userId);
  if (access !== 'member')
    return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
  if (note.userId !== userId)
    return NextResponse.json(
      { error: '본인이 작성한 메모만 수정할 수 있습니다.' },
      { status: 403 },
    );
  if (!text) return NextResponse.json({ error: '메모 내용을 입력해 주세요.' }, { status: 400 });
  const updated = updateNoteBody(note, text);
  return NextResponse.json({ note: updated });
}

export async function DELETE(request: NextRequest) {
  const userId = await getProducerId();
  if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id')?.trim() || '';
  const note = getAnyNote(id);
  if (!note) return NextResponse.json({ error: '메모를 찾을 수 없습니다.' }, { status: 404 });
  const access = noteBoardAccess(note, userId);
  if (access !== 'member')
    return NextResponse.json({ error: '팀 보드 접근 권한이 없습니다.' }, { status: 403 });
  if (note.userId !== userId)
    return NextResponse.json(
      { error: '본인이 작성한 메모만 삭제할 수 있습니다.' },
      { status: 403 },
    );
  deleteStoredNote(note);
  return NextResponse.json({ ok: true });
}
