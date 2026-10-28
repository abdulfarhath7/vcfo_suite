'use client';

import type { ReactNode } from 'react';
import { DashHero } from '@/components/dash/DashHero';
import {
  internFirstName,
  internGreeting,
  internGreetingHour,
  internWorkPath,
  type InternWorkKpis,
} from '@/lib/intern/intern-work';

/**
 * The lead's home card (prototype TodayScreen greeting, R-17, R-18): the shared `DashHero`
 * with the date, the greeting, the actions passed as children (the scope switch) and five
 * number tiles: needs action, overdue, waiting, due this week and done today. Each number but
 * the last opens Work with that focus.
 */
export function LeadHero({ name, kpis, children }: { name: string; kpis: InternWorkKpis; children?: ReactNode }) {
  const first = internFirstName(name);
  const greet = internGreeting(internGreetingHour(new Date()));

  return (
    <DashHero
      title={`Good ${greet}, ${first}`}
      stats={[
        { label: 'Needs action', value: kpis.action.total, href: internWorkPath({ focus: 'action' }) },
        {
          label: 'Overdue',
          value: kpis.overdue.total,
          href: internWorkPath({ focus: 'overdue' }),
          hot: kpis.overdue.total > 0,
        },
        { label: 'Waiting', value: kpis.waiting.total, href: internWorkPath({ focus: 'waiting' }) },
        { label: 'Due this week', value: kpis.dueWeek.total, href: internWorkPath({ focus: 'due' }) },
        { label: 'Done today', value: kpis.doneToday, good: kpis.doneToday > 0 },
      ]}
    >
      {children}
    </DashHero>
  );
}
