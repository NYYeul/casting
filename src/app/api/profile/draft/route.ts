// 프로필 PDF(또는 붙여넣은 글자) → 프로필 초안.
// 서버는 초안만 돌려주고 저장은 하지 않는다. 배우가 화면에서 확인하고 고른 항목만 프로필에 들어간다.

import { NextRequest, NextResponse } from 'next/server';
import { getActorId } from '@/lib/auth';
import { extractPdfText } from '@/lib/pdf-text';
import { draftFromText, draftSize } from '@/lib/profile-draft';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 200_000;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

const QUALITY_NOTE = {
  good: '글꼴을 여러 개 쓴 PDF에서는 일부 글자가 다르게 읽힐 수 있어요. 채우기 전에 값을 확인해 주세요.',
  thin: 'PDF에서 읽은 글자가 적어서 일부만 채웠어요. 비어 있는 항목은 직접 넣어 주세요.',
  none: 'PDF에서 글자를 찾지 못했어요. 사진으로 스캔한 PDF는 글자를 읽을 수 없어요. 아래에 내용을 붙여넣으면 초안을 만들어 드려요.',
} as const;

export async function POST(request: NextRequest) {
  if (!(await getActorId()))
    return NextResponse.json({ error: '배우 계정으로 로그인해 주세요.' }, { status: 401 });

  const type = request.headers.get('content-type') || '';

  // 글자를 직접 붙여넣는 길. PDF를 못 읽는 경우에도 늘 동작한다.
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : '';
    if (text.trim().length < 10)
      return NextResponse.json({ error: '읽을 내용이 너무 짧습니다.' }, { status: 400 });
    const draft = draftFromText(text);
    return NextResponse.json(
      { draft, filled: draftSize(draft), quality: 'good', note: '' },
      { headers: NO_STORE },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'PDF 파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: '파일은 5MB 이하만 올릴 수 있습니다.' }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-')
    return NextResponse.json({ error: 'PDF 파일만 읽을 수 있습니다.' }, { status: 415 });

  const { text, quality } = extractPdfText(bytes);
  const draft = quality === 'none' ? {} : draftFromText(text);
  return NextResponse.json(
    {
      draft,
      filled: draftSize(draft),
      quality,
      note: QUALITY_NOTE[quality],
      // 배우가 "이게 내 PDF에서 읽은 글자야?"를 직접 볼 수 있게 앞부분을 돌려준다.
      preview: text.slice(0, 2000),
    },
    { headers: NO_STORE },
  );
}
