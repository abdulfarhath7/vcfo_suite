import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KV {
  k: string;
  v: ReactNode;
  /** An identifier (CIN, PAN, GSTIN): Roboto Mono (R-28). */
  mono?: boolean;
}

/**
 * Label and value pairs (prototype KeyValue): a 12px muted label over a 13.5px weight-500 value,
 * in 1, 2 or 3 columns. Values truncate unless `wrap` (addresses).
 */
export function KeyValue({ rows, cols = 2, wrap, className }: { rows: KV[]; cols?: 1 | 2 | 3; wrap?: boolean; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3', className)}>
      {rows.map((r) => (
        <div key={r.k} className="min-w-0">
          <dt className="text-[12px] text-ink-muted">{r.k}</dt>
          <dd className={cn('text-[13.5px] font-medium text-ink', wrap ? 'break-words' : 'truncate', r.mono && 'font-mono text-[13px]')}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
