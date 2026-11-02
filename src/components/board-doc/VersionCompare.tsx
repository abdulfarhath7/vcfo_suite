'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { FilterSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { docDay } from './format';
import { diffValues } from './version-diff';
import type { DocVersion } from './types';

/**
 * T4: compare two versions of a draft. Two compact selects (the last two versions by default)
 * and one row per changed value, "before → after". The staff page puts it in a dialog.
 */
export function VersionCompare({
  versions,
  labels,
  initialFrom,
  initialTo,
  className,
}: {
  versions: DocVersion[];
  labels?: Record<string, string>;
  initialFrom?: string;
  initialTo?: string;
  className?: string;
}) {
  const last = versions[versions.length - 1];
  const prev = versions[versions.length - 2];
  const [fromId, setFromId] = useState(initialFrom ?? prev?.id ?? '');
  const [toId, setToId] = useState(initialTo ?? last?.id ?? '');

  if (versions.length < 2) return <EmptyState title="One version only" className={className} />;

  const from = versions.find((v) => v.id === fromId) ?? prev!;
  const to = versions.find((v) => v.id === toId) ?? last!;
  const rows = diffValues(from.values, to.values, labels);
  const options = versions.map((v) => ({ value: v.id, label: [v.label, docDay(v.at)].filter(Boolean).join(' · ') }));

  return (
    <div className={cn('grid gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect aria-label="From version" options={options} value={from.id} onChange={(e) => setFromId(e.target.value)} />
        <ArrowRight size={14} className="text-ink-faint" aria-hidden />
        <FilterSelect aria-label="To version" options={options} value={to.id} onChange={(e) => setToId(e.target.value)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No values changed" />
      ) : (
        <ul className="m-0 list-none divide-y divide-line-soft overflow-hidden rounded-md border-1.5 border-line bg-surface-raised p-0" aria-label="Changed values">
          {rows.map((r) => (
            <li key={r.key} className="grid gap-1 px-4 py-2.5 text-[13px] sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-3">
              <span className="text-ink-muted">{r.label}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <del className={cn('break-words decoration-line-strong', r.before ? 'text-ink-muted' : 'text-ink-faint no-underline')}>{r.before || 'Empty'}</del>
                <ArrowRight size={13} className="flex-none text-ink-faint" aria-label="to" />
                <ins className={cn('break-words font-medium no-underline', r.after ? 'text-ink' : 'text-ink-faint')}>{r.after || 'Empty'}</ins>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
