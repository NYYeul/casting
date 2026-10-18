import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { createEvent, findTimeConflict, MEETING_TYPES, normalizeStartsAt } from '@/lib/calendar';
import { requiredText } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = requiredText(body.title, 100);
  const actorName = requiredText(body.actorName, 60);
  const note = requiredText(body.note, 500);
  const projectId = requiredText(body.projectId, 60) || null;
  const place = requiredText(body.place, 200);
  const meetingType = requiredText(body.meetingType, 20);
  const startsAt = normalizeStartsAt(body.startsAt);
  if (!title || !actorName || !startsAt)
    return NextResponse.json(
      { error: '제목, 배우 이름, 일시(YYYY-MM-DD HH:MM)를 입력해 주세요.' },
      { status: 400 },
    );
  if (meetingType && !MEETING_TYPES.includes(meetingType as 'in-person' | 'remote'))
    return NextResponse.json(
      { error: '유형은 in-person(대면) 또는 remote(비대면)이어야 합니다.' },
      { status: 400 },
    );
  const result = createEvent(producerId, {
    title,
    actorName,
    startsAt,
    projectId,
    note,
    place,
    meetingType: meetingType as 'in-person' | 'remote' | '',
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const conflict = findTimeConflict(producerId, result.event.startsAt, result.event.id);
  return NextResponse.json(conflict ? { event: result.event, conflict } : { event: result.event }, {
    status: 201,
  });
}
