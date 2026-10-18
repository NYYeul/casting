import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const MAX_BYTES = 5 * 1024 * 1024;

function detectImage(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'webp';
  return null;
}

export async function POST(request: NextRequest) {
  if (!(await getSession()))
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: '파일을 선택해 주세요.' }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: '사진은 5MB 이하만 올릴 수 있습니다.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImage(bytes);
  if (!ext)
    return NextResponse.json({ error: 'JPG, PNG, WEBP 사진만 올릴 수 있습니다.' }, { status: 415 });
  const dir = join(process.cwd(), 'data', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, name), bytes);
  return NextResponse.json({ url: `/api/uploads/${name}` }, { status: 201 });
}
