'use client';

import { DashHero } from '@/components/dash/DashHero';
import {
  internFirstName,
  internGreeting,
  internGreetingHour,
  internWorkPath,
  type InternWorkKpis,
} from '@/lib/intern-work';

/**
 * The lead dashboard's greeting card — the shared `DashHero` with the lead's
 * own numbers in it. The card itself (clock line, settings, hero skin, ambient
 * motion, ring, stat strip) is `DashHero`, so this and every other dashboard's
 * greeting card are the same object rather than lookalikes.
 */
export function LeadHero({ name, kpis }: { name: string; kpis: InternWorkKpis }) {
  const first = internFirstName(name);
  const greet = internGreeting(internGreetingHour(new Date()));
  const totalToday = kpis.doneToday + kpis.action.total;

  return (
    <DashHero
      title={`Good ${greet}, ${first}`}
      ring={{ value: kpis.doneToday, total: totalToday, caption: 'done today' }}
      stats={[
        { label: 'Action', value: kpis.action.total, href: internWorkPath({ focus: 'action' }) },
        {
          label: 'Overdue',
          value: kpis.overdue.total,
          href: internWorkPath({ focus: 'overdue' }),
          hot: kpis.overdue.total > 0,
        },
        { label: 'Waiting', value: kpis.waiting.total, href: internWorkPath({ focus: 'waiting' }) },
        { label: 'This week', value: kpis.dueWeek.total, href: internWorkPath({ focus: 'due' }) },
      ]}
    />
  );
}
