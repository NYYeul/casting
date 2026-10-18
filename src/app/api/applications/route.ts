import { NextRequest, NextResponse } from 'next/server';
import { getProposal, setProposalStatus } from '@/lib/accounts';
import { getActorId, getProducerId } from '@/lib/auth';
import {
  createApplication,
  getRole,
  listApplications,
  listRecentApplications,
  recordEvent,
  roleOwnedBy,
} from '@/lib/db';
import { requiredText, safeImageRef, safeUrl, validEmail } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const roleId = request.nextUrl.searchParams.get('roleId') || '';
  if (!roleId) return NextResponse.json({ applications: listRecentApplications(producerId, 12) });
  if (!roleOwnedBy(roleId, producerId))
    return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ applications: listApplications(roleId) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = getRole(requiredText(body.roleSlug, 100));
  if (!role) return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  if (role.isClosed || (role.deadline && role.deadline < new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: '지원이 마감된 배역입니다.' }, { status: 409 });
  }
  const name = requiredText(body.name, 80);
  const email = requiredText(body.email, 254).toLowerCase();
  const phone = requiredText(body.phone, 50);
  const introduction = requiredText(body.introduction, 2000);
  const photoUrl = safeImageRef(body.photoUrl);
  const videoUrl = safeUrl(body.videoUrl);
  const available = requiredText(body.available, 20);
  const travel = requiredText(body.travel, 20);
  const payAccepted = requiredText(body.payAccepted, 20);
  const skill = requiredText(body.skill, 300);
  const age = body.age === '' || body.age == null ? null : Number(body.age);
  if (
    !name ||
    !validEmail(email) ||
    !phone ||
    !introduction ||
    !videoUrl ||
    !['yes', 'no', 'unsure'].includes(available) ||
    !['yes', 'no', 'unsure'].includes(travel) ||
    !['yes', 'no', 'unsure'].includes(payAccepted) ||
    (age !== null && (!Number.isInteger(age) || age < 1 || age > 120))
  ) {
    return NextResponse.json({ error: '필수 항목과 영상 링크를 확인해 주세요.' }, { status: 400 });
  }
  const actorId = await getActorId();
  try {
    const application = createApplication(
      role.id,
      {
        name,
        age,
        email,
        phone,
        introduction,
        photoUrl,
        videoUrl,
        available,
        travel,
        payAccepted,
        skill,
      },
      actorId,
    );
    const proposalId = requiredText(body.proposalId, 60);
    if (actorId && proposalId) {
      const proposal = getProposal(proposalId);
      if (proposal && proposal.actorId === actorId && proposal.roleId === role.id)
        setProposalStatus(proposalId, actorId, 'accepted');
    }
    return NextResponse.json({ receiptToken: application.receiptToken }, { status: 201 });
  } catch (error) {
    if (String(error).includes('UNIQUE constraint'))
      return NextResponse.json(
        { error: '이 이메일로 이미 지원했습니다. 기존 접수 링크를 확인해 주세요.' },
        { status: 409 },
      );
    throw error;
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = getRole(requiredText(body.roleSlug, 100));
  if (!role) return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  recordEvent(role.id, null, 'application_started');
  return NextResponse.json({ ok: true });
}
