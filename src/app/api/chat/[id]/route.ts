import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import {
  applicationOwnedBy,
  getApplication,
  getChatMessage,
  listChatMessages,
  respondToOffer,
  sendChatMessage,
} from '@/lib/db';
import { requiredText } from '@/lib/validation';

async function authorize(request: NextRequest, applicationId: string, receipt?: string) {
  const application = getApplication(applicationId);
  const token = receipt || request.headers.get('x-receipt-token') || '';
  if (token)
    return application?.chatOpen && token.length >= 40 && token === application.receiptToken
      ? ('actor' as const)
      : null;
  const producerId = await getProducerId();
  if (producerId && applicationOwnedBy(applicationId, producerId)) return 'producer' as const;
  return null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const actor = await authorize(request, id);
  if (!actor) return NextResponse.json({ error: '대화를 볼 수 없습니다.' }, { status: 403 });
  return NextResponse.json(
    { messages: listChatMessages(id) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const sender = await authorize(request, id, requiredText(body.receipt, 100));
  if (!sender) return NextResponse.json({ error: '대화를 보낼 수 없습니다.' }, { status: 403 });
  const kind = body.kind === 'offer' ? 'offer' : 'text';
  if (kind === 'offer' && sender !== 'producer')
    return NextResponse.json({ error: '제작자만 일정을 제안할 수 있습니다.' }, { status: 403 });
  const text = requiredText(body.body, 1500);
  const slots = Array.isArray(body.slots)
    ? ([
        ...new Set(
          body.slots.filter(
            (slot: unknown) =>
              typeof slot === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot),
          ),
        ),
      ].slice(0, 3) as string[])
    : [];
  const place = requiredText(body.place, 200);
  const preparation = requiredText(body.preparation, 500);
  if (kind === 'text' && !text)
    return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
  if (kind === 'offer' && (slots.length < 2 || !place))
    return NextResponse.json({ error: '시간과 장소를 입력해 주세요.' }, { status: 400 });
  const message = sendChatMessage(id, { sender, kind, body: text, slots, place, preparation });
  return message
    ? NextResponse.json({ message }, { status: 201 })
    : NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const sender = await authorize(request, id, requiredText(body.receipt, 100));
  if (!sender) return NextResponse.json({ error: '대화를 변경할 수 없습니다.' }, { status: 403 });
  const message = getChatMessage(requiredText(body.messageId, 100));
  if (!message || message.applicationId !== id)
    return NextResponse.json({ error: '제안을 찾을 수 없습니다.' }, { status: 404 });
  const action = body.action;
  if (
    (action === 'select' || action === 'decline' || action === 'request_change') &&
    sender !== 'actor'
  )
    return NextResponse.json({ error: '배우만 응답할 수 있습니다.' }, { status: 403 });
  if (action === 'confirm' && sender !== 'producer')
    return NextResponse.json({ error: '제작자만 확정할 수 있습니다.' }, { status: 403 });
  if (!['select', 'decline', 'request_change', 'confirm'].includes(action))
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 });
  const updated = respondToOffer(message.id, action, requiredText(body.selectedSlot, 30));
  return updated
    ? NextResponse.json({ message: updated })
    : NextResponse.json({ error: '현재 상태에서는 처리할 수 없습니다.' }, { status: 409 });
}
