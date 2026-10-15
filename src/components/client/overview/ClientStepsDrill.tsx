'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { clientStepHref, type ClientOverviewMilestone } from '@/lib/client-overview';
import { CardTabs, type CardTab } from '@/components/client/overview/CardTabs';

type DrillTab = 'all' | ClientOverviewMilestone['kind'];

const STATUS: Record<ClientOverviewMilestone['kind'], { label: string; chip: string }> = {
  done: { label: 'Completed', chip: 'bg-success-light text-success-text' },
  active: { label: 'Your turn', chip: 'bg-primary-light text-primary' },
  waiting: { label: 'With the team', chip: 'bg-warning-light text-warning-text' },
  locked: { label: 'Upcoming', chip: 'bg-muted text-muted-foreground' },
};

const TAB_ORDER: DrillTab[] = ['all', 'done', 'active', 'waiting', 'locked'];

/**
 * Click-to-drill from a summary number: every incorporation step, filterable
 * by status. Open steps link into the gated flow; upcoming ones stay text.
 */
export function ClientStepsDrill({
  milestones,
  trigger,
  initialTab = 'all',
}: {
  milestones: ClientOverviewMilestone[];
  trigger: ReactNode;
  initialTab?: DrillTab;
}) {
  const [tab, setTab] = useState<DrillTab>(initialTab);
  const tabs = useMemo<CardTab<DrillTab>[]>(
    () =>
      TAB_ORDER.map((id) => ({
        id,
        label: id === 'all' ? 'All' : STATUS[id].label,
        count: id === 'all' ? milestones.length : milestones.filter((m) => m.kind === id).length,
      })),
    [milestones],
  );
  const rows = tab === 'all' ? milestones : milestones.filter((m) => m.kind === tab);

  return (
    <Dialog onOpenChange={(open) => open && setTab(initialTab)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(640px,85vh)] max-w-xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 p-5">
        <div>
          <DialogTitle className="text-[16px]">Incorporation steps</DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px]">
            {milestones.filter((m) => m.kind === 'done').length} of {milestones.length} complete
          </DialogDescription>
        </div>
        <CardTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Filter steps" />
        <ul role="tabpanel" className="min-h-0 divide-y divide-border overflow-y-auto border-y border-border">
          {rows.length === 0 ? (
            <li className="py-3 text-[13px] text-muted-foreground">Nothing here right now.</li>
          ) : (
            rows.map((step) => {
              const status = STATUS[step.kind];
              const body = (
                <>
                  <span className="mono w-6 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {milestones.indexOf(step) + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{step.title}</span>
                  <span className={cn('shrink-0 rounded-sm px-1.5 py-px text-[11px] font-semibold', status.chip)}>
                    {status.label}
                  </span>
                </>
              );
              return (
                <li key={step.id}>
                  {step.kind === 'locked' ? (
                    <div className="flex items-center gap-2 py-2">{body}</div>
                  ) : (
                    <Link
                      href={clientStepHref(step.id)}
                      className="flex items-center gap-2 py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })
          )}
        </ul>
        <Link
          href="/app/client/incorporation"
          className="justify-self-end text-[12.5px] font-medium text-primary hover:underline"
        >
          Open Incorporation
        </Link>
      </DialogContent>
    </Dialog>
  );
}
