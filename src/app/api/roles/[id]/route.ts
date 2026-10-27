import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { roleOwnedBy, updateRole } from '@/lib/db';
import { requiredText } from '@/lib/validation';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { id } = await context.params;
  if (!(await roleOwnedBy(id, producerId)))
    return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const fields = [
    'projectTitle',
    'title',
    'description',
    'shootDate',
    'location',
    'pay',
    'deadline',
    'contactName',
    'announcementDate',
    'requirement',
  ] as const;
  const input: Record<string, string | boolean> = {};
  for (const key of fields)
    if (key in body) input[key] = requiredText(body[key], key === 'description' ? 2000 : 500);
  if (typeof body.isClosed === 'boolean') input.isClosed = body.isClosed;
  const role = await updateRole(id, input);
  return role
    ? NextResponse.json({ role })
    : NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
}
