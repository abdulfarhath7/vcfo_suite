'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar, type ProgressTone } from '@/components/common/ProgressBar';
import { Chip, OwnerChip, type ChipTone, type Owner } from '@/components/ui/spectrum-chip';
import { Chevron } from '@/components/ui/chevron';

/**
 * Phase rows (prototype cards/PhaseRows, K-21): one flat row per phase with a 6px bar, the
 * done/total count and a 104px status chip. A phase with `steps` opens a T1 step table:
 * #, Step, Owner chip, Status chip, Typical time and a chevron. The typical time comes from the
 * checklist itself (`getChecklistStepTimelineLabel` in `src/data/checklist.ts`), never from
 * sample data. `onAbout` adds "What's this?" to each step row.
 */
export interface PhaseStep {
  n: number;
  title: string;
  owner: Owner;
  ownerLabel?: string;
  status: string;
  tone?: ChipTone;
  /** "2–3 days"; empty shows a dash. */
  time?: string;
  href?: string;
}

export interface Phase {
  id: string;
  name: string;
  done: number;
  total: number;
  status: string;
  tone?: ChipTone;
  barTone?: ProgressTone;
  href?: string;
  steps?: PhaseStep[];
}

export function PhaseRows({
  phases,
  openId,
  className,
  onAbout,
}: {
  phases: Phase[];
  openId?: string;
  className?: string;
  onAbout?: (n: number) => void;
}) {
  const [open, setOpen] = useState<string | null>(openId ?? null);
  return (
    <div className={className}>
      {phases.map((p) => {
        const isOpen = open === p.id;
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        const toggle = p.steps ? () => setOpen(isOpen ? null : p.id) : undefined;
        return (
          <div key={p.id} className="border-t border-line-soft first:border-t-0">
            <div
              className={cn(
                'grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-[13.5px] md:grid-cols-[16px_minmax(0,1fr)_120px_40px_104px] md:px-5',
                p.steps && 'cursor-pointer hover:bg-hover',
                isOpen && 'bg-hover',
              )}
              onClick={toggle}
              onKeyDown={
                toggle
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                      }
                    }
                  : undefined
              }
              role={p.steps ? 'button' : undefined}
              tabIndex={p.steps ? 0 : undefined}
              aria-expanded={p.steps ? isOpen : undefined}
            >
              {p.steps ? <Chevron open={isOpen} /> : <span />}
              <span className="min-w-0 truncate font-medium text-ink">
                {p.href ? (
                  <Link href={p.href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {p.name}
                  </Link>
                ) : (
                  p.name
                )}
              </span>
              <ProgressBar value={pct} tone={p.barTone ?? (pct === 100 ? 'ok' : 'accent')} className="hidden md:block" />
              <span className="hidden text-right text-[12.5px] tabular-nums text-ink-muted md:block">
                {p.done}/{p.total}
              </span>
              <Chip tone={p.tone} fixed>
                {p.status}
              </Chip>
            </div>
            {isOpen && p.steps ? (
              <div className="overflow-x-auto border-t border-line-soft">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th className="num w-10">#</th>
                      <th>Step</th>
                      <th className="w-[120px]">Owner</th>
                      <th className="w-[132px]">Status</th>
                      <th className="w-[150px]">Typical time</th>
                      <th className="w-10" aria-label="Open" />
                    </tr>
                  </thead>
                  <tbody>
                    {p.steps.map((s) => (
                      <tr key={s.n}>
                        <td className="num font-mono text-ink-faint">{s.n}</td>
                        <td className="font-medium">
                          {s.href ? (
                            <Link href={s.href} className="hover:underline">
                              {s.title}
                            </Link>
                          ) : (
                            s.title
                          )}
                          {onAbout ? (
                            <button type="button" onClick={() => onAbout(s.n)} className="ml-2.5 whitespace-nowrap text-[11.5px] font-semibold text-brand-text hover:underline">
                              What&apos;s this?
                            </button>
                          ) : null}
                        </td>
                        <td>
                          <OwnerChip owner={s.owner} label={s.ownerLabel} />
                        </td>
                        <td>
                          <Chip tone={s.tone} fixed>
                            {s.status}
                          </Chip>
                        </td>
                        <td className="text-ink-muted">{s.time || '—'}</td>
                        <td className="text-ink-faint">
                          {s.href ? (
                            <Link href={s.href} aria-label={`Open step ${s.n}`}>
                              <ChevronRight size={16} strokeWidth={1.6} />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
