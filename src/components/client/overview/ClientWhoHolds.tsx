'use client';

import { useMemo, useState, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Landmark, UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlossaryText } from '@/components/ask/GlossaryTerm';
import { AskAboutThis } from '@/components/ask/AskAboutThis';
import {
  clientStepHref,
  stepHolder,
  type ClientOverviewMilestone,
  type ClientStepHolder,
} from '@/lib/client-overview';
import { CardTabs, firstFilledTab, type CardTab } from '@/components/client/overview/CardTabs';
import { CardHeading } from '@/components/client/overview/CardHeading';

const LIST_LIMIT = 4;

const HOLDERS: {
  id: ClientStepHolder;
  label: string;
  hue: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  status: string;
  empty: string;
}[] = [
  { id: 'you', label: 'You', hue: 'var(--primary)', icon: UserRound, status: 'Your turn', empty: 'Nothing is waiting on you.' },
  {
    id: 'team',
    label: 'VCFO team',
    hue: 'var(--warning)',
    icon: Users,
    status: 'With the team',
    empty: 'Nothing is with the team right now.',
  },
  {
    id: 'mca',
    label: 'MCA',
    hue: 'var(--muted-foreground)',
    icon: Landmark,
    status: 'MCA reviewing',
    empty: 'Nothing is with MCA yet. It moves there once the team files with the ministry.',
  },
];

/**
 * WHO HOLDS IT NOW — every open step by who owns the next move: the client,
 * the VCFO team, or MCA deciding on a filing. Locked steps belong to nobody.
 */
export function ClientWhoHolds({ milestones }: { milestones: ClientOverviewMilestone[] }) {
  const byHolder = useMemo(() => {
    const groups: Record<ClientStepHolder, ClientOverviewMilestone[]> = { you: [], team: [], mca: [] };
    for (const milestone of milestones) {
      const holder = stepHolder(milestone);
      if (holder) groups[holder].push(milestone);
    }
    return groups;
  }, [milestones]);

  const tabs = useMemo<CardTab<ClientStepHolder>[]>(
    () =>
      HOLDERS.map((holder) => ({
        id: holder.id,
        label: holder.label,
        count: byHolder[holder.id].length,
        hue: holder.hue,
        icon: holder.icon,
      })),
    [byHolder],
  );
  const [picked, setPicked] = useState<ClientStepHolder | null>(null);
  const tab = picked ?? firstFilledTab(tabs);
  const holder = HOLDERS.find((entry) => entry.id === tab)!;
  const steps = byHolder[tab];
  const shown = steps.slice(0, LIST_LIMIT);
  const total = byHolder.you.length + byHolder.team.length + byHolder.mca.length;
  const HolderIcon = holder.icon;

  return (
    <section className="min-w-0" aria-label="Who holds it now">
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <CardHeading icon={Building2} hue="var(--accent-teal)" title="Who holds it now" />
        <AskAboutThis question="Who is working on my company setup right now, and what are they waiting for?" className="ml-auto" />
      </div>
      <div className="px-5 pb-4 pt-3">
        {total === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-snug text-muted-foreground">
            Nothing is open on any side right now. We will start the next milestone and let you know if we
            need anything.
          </p>
        ) : (
          <>
            <div
              className="flex h-2.5 gap-1 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${byHolder.you.length} with you, ${byHolder.team.length} with the VCFO team, ${byHolder.mca.length} with MCA`}
            >
              {HOLDERS.map((entry) =>
                byHolder[entry.id].length > 0 ? (
                  <span
                    key={entry.id}
                    className="rounded-full bg-[oklch(var(--seg))]"
                    style={{ flex: byHolder[entry.id].length, '--seg': entry.hue } as CSSProperties}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-3">
              <CardTabs tabs={tabs} value={tab} onChange={setPicked} ariaLabel="Who holds it" />
            </div>
            {shown.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-muted-foreground">{holder.empty}</p>
            ) : (
              <ul role="tabpanel" className="mt-3 space-y-1.5" style={{ '--hold': holder.hue } as CSSProperties}>
                {shown.map((step) => (
                  <li
                    key={step.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-panel px-2.5 py-2 transition-colors hover:border-[oklch(var(--hold)/0.4)]"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[oklch(var(--hold)/0.12)] text-[oklch(var(--hold))]">
                      <HolderIcon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">
                        <GlossaryText text={step.title} />
                      </span>
                      <span className="block text-[11.5px] font-medium text-[oklch(var(--hold))]">{holder.status}</span>
                    </span>
                    <Link
                      href={clientStepHref(step.id)}
                      className={cn(
                        'group inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        tab === 'you'
                          ? 'bg-primary text-primary-foreground shadow-[0_6px_14px_-8px_oklch(var(--primary))] hover:bg-primary-dark'
                          : 'border border-border text-foreground hover:bg-muted',
                      )}
                    >
                      {tab === 'you' ? 'Continue' : 'Open'}
                      <span className="sr-only"> {step.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
                {steps.length > shown.length ? (
                  <li className="pt-1 text-[12px]">
                    <Link href="/app/client/incorporation" className="font-semibold text-primary hover:underline">
                      +{steps.length - shown.length} more in Incorporation
                    </Link>
                  </li>
                ) : null}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
