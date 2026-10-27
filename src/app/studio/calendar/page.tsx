import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listProjects } from '@/lib/accounts';
import { buildMonthGrid, listMonthEvents, todayKst, type CalendarEvent } from '@/lib/calendar';
import CalendarClient from './calendar-client';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/calendar');
  if (session.role !== 'producer') redirect('/me');
  const today = todayKst();
  const month = today.slice(0, 7);
  const [year, m] = month.split('-').map(Number);
  const days: Record<string, CalendarEvent[]> = {};
  for (const day of await listMonthEvents(session.userId, year, m)) days[day.date] = day.events;
  return (
    <CalendarClient
      initialMonth={month}
      initialWeeks={buildMonthGrid(year, m)}
      initialDays={days}
      today={today}
      projects={(await listProjects(session.userId)).map((project) => ({
        id: project.id,
        title: project.title,
      }))}
    />
  );
}
