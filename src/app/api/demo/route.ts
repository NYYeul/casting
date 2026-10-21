import { NextRequest, NextResponse } from 'next/server';
import { getUserWithHash } from '@/lib/accounts';
import { hasSetup, homeFor, startSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: '체험 모드를 사용할 수 없습니다.' }, { status: 404 });
  }
  if (!hasSetup()) {
    return NextResponse.json({ error: '체험을 준비 중입니다.' }, { status: 503 });
  }
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const role = form?.get('role');
  if (role !== 'producer' && role !== 'actor') {
    return NextResponse.json({ error: '체험할 역할을 선택해 주세요.' }, { status: 400 });
  }
  const account = getUserWithHash(
    role === 'producer' ? 'producer@demo.casting' : 'actor01@demo.casting',
  );
  if (!account) {
    return NextResponse.json({ error: '체험 계정을 준비 중입니다.' }, { status: 503 });
  }
  await startSession({ userId: account.user.id, role: account.user.role });
  return new NextResponse(null, {
    status: 303,
    headers: { Location: homeFor(account.user.role), 'Cache-Control': 'no-store' },
  });
}
