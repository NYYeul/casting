import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import {
  deleteEvent,
  EVENT_STATUSES,
  findTimeConflict,
  MEETING_TYPES,
  normalizeStartsAt,
  updateEvent,
  type EventStatus,
  type MeetingType,
} from '@/lib/calendar';
import { requiredText } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input: {
    status?: EventStatus;
    note?: string;
    startsAt?: string;
    place?: string;
    meetingType?: MeetingType | '';
  } = {};
  if (body.status !== undefined) {
    if (!EVENT_STATUSES.includes(body.status))
      return NextResponse.json(
        { error: 'status는 scheduled|done|canceled 중 하나여야 합니다.' },
        { status: 400 },
      );
    input.status = body.status;
  }
  if (body.note !== undefined) input.note = requiredText(body.note, 500);
  if (body.place !== undefined) input.place = requiredText(body.place, 200);
  if (body.meetingType !== undefined) {
    const meetingType = requiredText(body.meetingType, 20);
    if (meetingType && !MEETING_TYPES.includes(meetingType as MeetingType))
      return NextResponse.json(
        { error: '유형은 in-person(대면) 또는 remote(비대면)이어야 합니다.' },
        { status: 400 },
      );
    input.meetingType = meetingType as MeetingType | '';
  }
  if (body.startsAt !== undefined) {
    const startsAt = normalizeStartsAt(body.startsAt);
    if (!startsAt)
      return NextResponse.json({ error: '일시 형식이 올바르지 않습니다.' }, { status: 400 });
    input.startsAt = startsAt;
  }
  const event = updateEvent(producerId, id, input);
  if (!event) return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
  const conflict =
    input.startsAt !== undefined ? findTimeConflict(producerId, event.startsAt, event.id) : null;
  return NextResponse.json(conflict ? { event, conflict } : { event });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  return deleteEvent(producerId, id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
}
