'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip, OwnerChip, Tag } from '@/components/ui/spectrum-chip';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { LeadCompanyChip } from '@/components/intern/LeadCompanyChip';
import { internKindOwner, internKindStatus } from '@/components/intern/intern-tones';
import { formatDueLabel, internWorkCta, type InternWorkItem } from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

const SOURCE_WORD: Record<string, string> = { step: 'Step', filing: 'Filing', request: 'Client request' };
const OPEN_WORD: Record<string, string> = { step: 'Open step', filing: 'Open filing', request: 'Open company' };

/**
 * Task drawer (prototype `TaskDrawer` and `WorkDrawer`): a right-side panel with the work item's
 * facts and the actions the row already had, so the lead can read a task without leaving Work.
 * Every fact comes from the work item itself; nothing here is invented for the panel. The step,
 * filing or company page stays one click away for the full form.
 */
export function InternWorkDrawer({
  item,
  now,
  onClose,
}: {
  item: InternWorkItem | null;
  now: Date;
  onClose: () => void;
}) {
  const status = item ? internKindStatus(item) : null;
  const owner = item ? internKindOwner(item.kind) : undefined;
  const cta = item ? internWorkCta(item) : null;
  const facts: Array<{ k: string; v: ReactNode }> = item
    ? [
        { k: 'Company', v: item.companyName },
        { k: 'Type', v: SOURCE_WORD[item.source] ?? 'Step' },
        ...(item.catalogLabel ? [{ k: 'Step', v: <span className="font-mono text-[13px]">{item.catalogLabel}</span> }] : []),
        {
          k: 'Due',
          v: <span className={cn(item.isOverdue && item.kind !== 'done' && 'font-medium text-danger')}>{formatDueLabel(item.dueAt, now)}</span>,
        },
        ...(item.windowLabel ? [{ k: 'Window', v: <span className="tabular-nums">{item.windowLabel}</span> }] : []),
        ...(item.startedAt ? [{ k: 'Started', v: formatDueLabel(item.startedAt, now) }] : []),
        ...(item.completedAt ? [{ k: 'Done', v: formatDueLabel(item.completedAt, now) }] : []),
        ...(item.ageLabel ? [{ k: 'Waiting for', v: item.ageLabel }] : []),
        { k: 'State', v: item.why },
      ]
    : [];

  return (
    <Sheet open={!!item} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 border-l-1.5 border-line bg-surface-raised p-0 sm:max-w-[480px]"
      >
        {item && status ? (
          <>
            <header className="border-b border-line-soft px-5 pb-4 pr-12 pt-5">
              <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-muted">
                <LeadCompanyChip name={item.companyName} compact />
                <span className="truncate">{item.companyName}</span>
                {item.catalogLabel ? <span className="flex-none font-mono">· {item.catalogLabel}</span> : null}
              </div>
              <SheetTitle className="mt-1.5 text-[16px] font-medium leading-snug text-ink">{item.title}</SheetTitle>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Chip tone={status.tone} title={item.why}>
                  {status.word}
                </Chip>
                {owner ? <OwnerChip owner={owner} label={owner === 'client' ? 'With client' : 'With manager'} /> : null}
                {item.isCritical ? <Tag tone="bad">Critical</Tag> : null}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px]">
                {facts.map((f) => (
                  <div key={f.k} className="contents">
                    <dt className="text-ink-muted">{f.k}</dt>
                    <dd className="min-w-0 text-ink">{f.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-3">
              {cta && (cta.action !== 'open' || item.kind === 'done') ? (
                <Button variant="secondary" asChild>
                  <Link href={item.href}>{OPEN_WORD[item.source] ?? 'Open'}</Link>
                </Button>
              ) : null}
              <InternWorkCtaButton item={item} primary />
            </footer>
          </>
        ) : (
          <SheetTitle className="sr-only">Task</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
