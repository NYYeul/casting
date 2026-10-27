import { NextRequest, NextResponse } from 'next/server';
import { getProducerId } from '@/lib/auth';
import { buildMonthGrid, listMonthEvents, todayKst, type CalendarEvent } from '@/lib/calendar';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const month = request.nextUrl.searchParams.get('month') || todayKst().slice(0, 7);
  if (!MONTH.test(month))
    return NextResponse.json({ error: 'month는 YYYY-MM 형식이어야 합니다.' }, { status: 400 });
  const [year, m] = month.split('-').map(Number);
  const days: Record<string, CalendarEvent[]> = {};
  for (const day of await listMonthEvents(producerId, year, m)) days[day.date] = day.events;
  return NextResponse.json(
    { month, today: todayKst(), weeks: buildMonthGrid(year, m), days },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
