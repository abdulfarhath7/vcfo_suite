'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { InternSectionHeadingNav } from '@/views/incorporation/MilestoneResponseFormParts';

/**
 * A registration tracker as one compact card (owner request 2026-11-11): collapsed, it
 * shows the title, the stage count, the key facts and the notice; clicked, it opens the
 * process as the same tab strip the incorporation step forms use (green tick on a completed
 * tab, the stage's fields in the body, Back and Next in the footer). Used by the GST and the
 * LUT records.
 */

export interface TrackerTab {
  title: string;
  complete: boolean;
  /** A stage that needs attention (a resubmission) shows the strip's red mark. */
  attention?: boolean;
  content: ReactNode;
}

export function TrackerCard({
  label,
  title,
  form,
  facts,
  notice,
  tabs,
  initialTab,
  loading,
  error,
}: {
  /** Accessible name of the card. */
  label: string;
  title: string;
  /** The form reference shown under the title, e.g. "Form GST REG-01". */
  form: string;
  facts: Array<{ k: string; v: string | null; mono?: boolean }>;
  notice?: ReactNode;
  tabs: TrackerTab[];
  /** The tab to open on, usually the current stage. */
  initialTab: number;
  loading?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const done = tabs.filter((t) => t.complete).length;
  const panelId = `${label.replace(/\W+/g, '-').toLowerCase()}-panel`;

  return (
    <section aria-label={label} className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) setTab(initialTab);
          setOpen((o) => !o);
        }}
        className="grid w-full cursor-pointer gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-sunken/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[16px] font-semibold text-ink">{title}</span>
          <span className="text-[12.5px] text-ink-muted">{form}</span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[12px] font-medium tabular-nums',
              done === tabs.length ? 'bg-positive-soft text-positive' : 'bg-surface-sunken text-ink-2',
            )}
          >
            {done} of {tabs.length} stages complete
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text">
            {open ? 'Close' : 'Open'}
            <ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          </span>
        </span>
        <span className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {facts.map((f) => (
            <span key={f.k} className="min-w-0">
              <span className="block text-[12px] text-ink-muted">{f.k}</span>
              <span className={cn('block truncate text-[14px] font-medium', f.v ? 'text-ink' : 'font-normal text-ink-faint', f.v && f.mono && 'font-mono text-[13.5px]')}>
                {f.v || 'Not recorded'}
              </span>
            </span>
          ))}
        </span>
      </button>

      {notice}

      {open ? (
        <div id={panelId} className="border-t border-line-soft">
          {loading ? (
            <div className="p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : error ? (
            <p className="px-5 py-4 text-[13px] text-danger">{error}</p>
          ) : (
            <>
              <InternSectionHeadingNav
                sections={tabs.map((t) => ({ title: t.title, complete: t.complete, hasErrors: t.attention }))}
                selectedIndex={tab}
                onSelect={setTab}
              />
              <div role="tabpanel" aria-labelledby={`intern-section-tab-${tab}`} className="px-5 py-5">
                {tabs[tab]?.content}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3">
                {tab > 0 ? (
                  <Button variant="secondary" onClick={() => setTab(tab - 1)}>
                    Back
                  </Button>
                ) : null}
                {tab < tabs.length - 1 ? (
                  <Button onClick={() => setTab(tab + 1)}>Next</Button>
                ) : (
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
