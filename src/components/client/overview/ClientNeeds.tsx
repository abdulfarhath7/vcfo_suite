'use client';

import { useMemo, useState, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, PenLine, PenTool, RotateCcw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlossaryText } from '@/components/ask/GlossaryTerm';
import { AskAboutThis } from '@/components/ask/AskAboutThis';
import { alertDueLabel } from '@/lib/client-alerts';
import type { ClientNeedAction, ClientOverviewNeed } from '@/lib/client-overview';
import { formatClientDayMonth } from '@/components/client/overview/client-overview-format';
import { CardTabs, firstFilledTab, type CardTab } from '@/components/client/overview/CardTabs';
import { CardHeading } from '@/components/client/overview/CardHeading';

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

const ACTIONS: { id: ClientNeedAction; label: string; button: string; empty: string; hue: string; icon: Icon }[] = [
  { id: 'upload', label: 'Upload', button: 'Upload', empty: 'Nothing to upload right now.', hue: 'var(--accent-sky)', icon: Upload },
  { id: 'fill', label: 'Fill', button: 'Fill in', empty: 'No forms to fill right now.', hue: 'var(--primary)', icon: PenLine },
  { id: 'correct', label: 'Correct', button: 'Fix', empty: 'Nothing has been sent back to you.', hue: 'var(--danger)', icon: RotateCcw },
  { id: 'sign', label: 'Sign', button: 'Review & sign', empty: 'Nothing to sign right now.', hue: 'var(--accent-violet)', icon: PenTool },
];

function daysLeft(isoDate: string, now: Date): number {
  const due = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
}

/**
 * NEEDS FROM YOU — every step the gate has opened for the client, sorted by
 * what it asks of them. Each row deep-links into the step, which re-checks
 * the gate; nothing is performed from here.
 */
export function ClientNeeds({ needs, now = new Date() }: { needs: ClientOverviewNeed[]; now?: Date }) {
  const tabs = useMemo<CardTab<ClientNeedAction>[]>(
    () =>
      ACTIONS.map((action) => ({
        id: action.id,
        label: action.label,
        count: needs.filter((need) => need.action === action.id).length,
        hue: action.hue,
        icon: action.icon,
      })),
    [needs],
  );
  const preferred = needs.some((need) => need.action === 'correct') ? 'correct' : firstFilledTab(tabs);
  const [picked, setPicked] = useState<ClientNeedAction | null>(null);
  const tab = picked ?? preferred;
  const action = ACTIONS.find((entry) => entry.id === tab)!;
  const rows = needs.filter((need) => need.action === tab);

  return (
    <section className="client-rise border-t border-border" style={{ '--rise': 5 } as CSSProperties} aria-label="Needs from you">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4">
        <CardHeading icon={ClipboardList} hue="var(--primary)" title="Needs from you">
          {needs.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              <span className="client-live h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              {needs.length} open
            </span>
          ) : null}
        </CardHeading>
        <AskAboutThis question="What do you need from me right now, and why?" className="ml-auto" />
      </div>

      {needs.length === 0 ? (
        <div className="mx-5 my-3 flex items-center gap-3 rounded-lg bg-success-light px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success-text" strokeWidth={2} aria-hidden />
          <p className="text-[13px] font-semibold text-success-text">
            Nothing needed from you — you&rsquo;re all set, we&rsquo;re working on it.
          </p>
        </div>
      ) : (
        <>
          <div className="px-5 pb-3 pt-3">
            <CardTabs tabs={tabs} value={tab} onChange={setPicked} ariaLabel="What we need" />
          </div>
          {rows.length === 0 ? (
            <p className="px-5 pb-4 text-[13px] text-muted-foreground">{action.empty}</p>
          ) : (
            <ul role="tabpanel" className="space-y-2 px-5 pb-4">
              {rows.map((need) => {
                const left = need.dueDate ? daysLeft(need.dueDate, now) : null;
                const late = left !== null && left < 0;
                const ActionIcon = action.icon;
                return (
                  <li
                    key={need.stepId}
                    style={{ '--need': action.hue } as CSSProperties}
                    className="flex items-center gap-3 rounded-lg border border-[oklch(var(--need)/0.25)] bg-[linear-gradient(90deg,oklch(var(--need)/0.08),transparent_60%)] px-3 py-2.5"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[oklch(var(--need))] text-white shadow-[0_6px_14px_-8px_oklch(var(--need))]">
                      <ActionIcon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-foreground">
                        <GlossaryText text={need.title} />
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 truncate text-[12px] font-medium',
                          need.correctionNote ? 'text-danger-text' : 'text-muted-foreground',
                        )}
                      >
                        {need.correctionNote ??
                          (need.dueDate ? `Due ${formatClientDayMonth(need.dueDate)}` : 'Your step')}
                      </p>
                    </div>
                    {left !== null ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                          late
                            ? 'bg-danger text-white'
                            : left <= 3
                              ? 'bg-warning-light text-warning-text'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {alertDueLabel(left)}
                      </span>
                    ) : null}
                    <Link
                      href={need.href}
                      className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[oklch(var(--need))] px-4 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_oklch(var(--need))] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {action.button}
                      <span className="sr-only"> {need.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
