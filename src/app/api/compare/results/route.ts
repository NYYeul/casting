import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getProducerId } from '@/lib/auth';
import { isCompareState } from '@/lib/compare';
import { db, roleOwnedBy } from '@/lib/db';
import { requiredText } from '@/lib/validation';

type ResultRow = {
  id: string;
  title: string;
  winner_label: string;
  created_at: string;
};

export async function GET() {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const rows = (await db()
    .prepare(
      `SELECT id,title,winner_label,created_at FROM compare_results
       WHERE owner_id=? ORDER BY created_at DESC LIMIT 20`,
    )
    .all(producerId)) as ResultRow[];
  return NextResponse.json({
    results: rows.map((row) => ({
      id: row.id,
      title: row.title,
      winnerLabel: row.winner_label,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = requiredText(body.title, 100);
  const winnerLabel = requiredText(body.winnerLabel, 200);
  const roleId = requiredText(body.roleId, 60) || null;
  if (!title || !winnerLabel)
    return NextResponse.json({ error: '제목과 우승자 이름을 확인해 주세요.' }, { status: 400 });
  if (!isCompareState(body.bracket))
    return NextResponse.json({ error: '대진 데이터가 올바르지 않습니다.' }, { status: 400 });
  if (roleId && !(await roleOwnedBy(roleId, producerId)))
    return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });

  const bracketJson = JSON.stringify(body.bracket);
  if (bracketJson.length > 200_000)
    return NextResponse.json({ error: '대진 데이터가 너무 큽니다.' }, { status: 400 });

  const id = randomUUID();
  await db()
    .prepare(
      `INSERT INTO compare_results (id,owner_id,title,role_id,bracket_json,winner_label,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .run(id, producerId, title, roleId, bracketJson, winnerLabel, new Date().toISOString());
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
