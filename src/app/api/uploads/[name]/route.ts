import { dataDirectory } from '@/lib/data-directory';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export async function GET(_request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const match = /^([a-f0-9-]{36})\.(jpg|png|webp|pdf)$/.exec(name);
  if (!match) return new NextResponse('Not found', { status: 404 });
  try {
    const file = await readFile(join(dataDirectory(), 'uploads', name));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': TYPES[match[2]],
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
