'use client';

import type { ReactNode } from 'react';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { cn } from '@/lib/utils';

export type DocPreviewTab = 'draft' | 'signed';

const TABS = [
  { key: 'draft', label: 'Draft' },
  { key: 'signed', label: 'Signed copy' },
];

/**
 * The preview card with the Draft and Signed copy tabs (C5, C6). SpectrumTabs sends the tab
 * switch event, so a parent card keeps its switch animation. Both panels stay mounted, so the
 * Word preview does not render again on each switch.
 */
export function DocPreviewCard({
  tab,
  onTab,
  draft,
  signed,
  meta,
  right,
  className,
}: {
  tab: DocPreviewTab;
  onTab: (t: DocPreviewTab) => void;
  draft: ReactNode;
  signed: ReactNode;
  /** The version tag, for example "Version 2". */
  meta?: ReactNode;
  /** Zoom or full screen buttons. */
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 overflow-hidden rounded-md border-1.5 border-line bg-surface-raised', className)} aria-label="Preview">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
        <SpectrumTabs items={TABS} value={tab} onChange={(k) => onTab(k as DocPreviewTab)} label="Preview" />
        <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          {meta}
          {right}
        </div>
      </div>
      <div role="tabpanel" aria-label="Draft" hidden={tab !== 'draft'} className="min-w-0">
        {draft}
      </div>
      <div role="tabpanel" aria-label="Signed copy" hidden={tab !== 'signed'} className="min-w-0">
        {signed}
      </div>
    </section>
  );
}
