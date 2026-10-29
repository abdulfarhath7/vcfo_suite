'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CalendarDays, CheckCheck, ListChecks, User } from 'lucide-react';
import { DashHero, type DashHeroStat } from '@/components/dash/DashHero';
import { trendWithLive, useHomeTrends } from '@/hooks/use-home-trends';
import type { HomeTrends } from '@/lib/metrics/home-trends';
import {
  INTERN_TASKS_PATH,
  filterInternWork,
  internFirstName,
  internGreeting,
  internGreetingHour,
  internWorkPath,
  ymdFromIsoInIst,
  ymdInIst,
  type InternWorkItem,
} from '@/lib/intern/intern-work';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The five numbers of the lead's home card (R-18, E-04, E-05). Each number is counted with the
 * same filter as the Work list it opens, so the tile and the list always agree:
 *   Needs action        Work, focus Needs action
 *   Overdue             Work › My overdue   (?view=overdue)
 *   Waiting on clients  Work › Waiting on clients (?view=waiting)
 *   Due this week       Work › This week     (?view=week)
 *   Done today          no list; done items stay in Work for the week
 * Only "Done today" draws a trend line: its past days are rebuilt from the step events, the
 * task completion times and the filing dates. The other tiles mix step and filing windows that
 * keep no history (`src/db/repositories/home-trends.ts` lists what each home can draw).
 */
export function leadHeroStats(items: InternWorkItem[], now: Date, trends?: HomeTrends): DashHeroStat[] {
  const action = filterInternWork(items, { focus: 'action' }, now);
  const overdue = filterInternWork(items, { focus: 'overdue' }, now);
  const waiting = filterInternWork(items, { tag: 'client' }, now).filter((i) => i.kind !== 'done');
  const week = filterInternWork(items, { focus: 'due' }, now);
  const weekOpen = week.filter((i) => i.kind !== 'done');
  const today = ymdInIst(now);
  const doneToday = items.filter((i) => i.kind === 'done' && ymdFromIsoInIst(i.completedAt) === today).length;
  const doneWeek = week.length - weekOpen.length;
  const clients = (list: InternWorkItem[]) => new Set(list.map((i) => i.engagementId)).size;
  const sentBack = action.filter((i) => i.kind === 'rejected').length;
  const managerWaits = filterInternWork(items, { tag: 'manager' }, now).length;
  return [
    {
      label: 'Needs action',
      icon: ListChecks,
      value: action.length,
      href: internWorkPath({ focus: 'action' }),
      note: sentBack > 0 ? `${sentBack} sent back` : action.length > 0 ? plural(clients(action), 'client', 'clients') : undefined,
      how: 'Steps, filings and tasks where the next move is yours: sent back, to review, to deliver or to file.',
    },
    {
      label: 'Overdue',
      icon: AlertTriangle,
      value: overdue.length,
      href: `${INTERN_TASKS_PATH}?view=overdue`,
      hot: overdue.length > 0,
      note: overdue.length > 0 ? plural(clients(overdue), 'client', 'clients') : undefined,
      how: 'Open steps, filings and tasks past their due date.',
    },
    {
      label: 'Waiting on clients',
      icon: User,
      value: waiting.length,
      href: `${INTERN_TASKS_PATH}?view=waiting`,
      note: managerWaits > 0 ? `${managerWaits} on managers` : waiting.length > 0 ? plural(clients(waiting), 'client', 'clients') : undefined,
      how: 'Steps the client still has to fill and documents they still have to upload.',
    },
    {
      label: 'Due this week',
      icon: CalendarDays,
      value: weekOpen.length,
      href: `${INTERN_TASKS_PATH}?view=week`,
      note: doneWeek > 0 ? `${doneWeek} done` : undefined,
      how: 'Open work due from Monday to Sunday this week (IST).',
    },
    {
      label: 'Done today',
      icon: CheckCheck,
      value: doneToday,
      good: doneToday > 0,
      trend: trendWithLive(trends, 'doneToday', doneToday),
      trendTone: 'ok',
      how: 'Steps, filings and tasks you finished today.',
    },
  ];
}

/**
 * The lead's home card (prototype TodayScreen greeting, R-17, R-18, D-17): the shared `DashHero`
 * with the greeting and date, the scope switch (`scope`) and the actions passed as children on
 * the right, then the five number tiles. The switch narrows the cards below the home card.
 */
export function LeadHero({
  name,
  items,
  now,
  scope,
  children,
}: {
  name: string;
  items: InternWorkItem[];
  now: Date;
  /** The All / Incorporating / Compliance switch (D-17 put it back in the home card). */
  scope?: ReactNode;
  children?: ReactNode;
}) {
  const first = internFirstName(name);
  const greet = internGreeting(internGreetingHour(now));
  const trends = useHomeTrends('lead');
  return (
    <DashHero title={`Good ${greet}, ${first}`} stats={leadHeroStats(items, now, trends)} scope={scope}>
      {children}
    </DashHero>
  );
}
