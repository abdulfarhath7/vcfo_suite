import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { EvidenceRow } from './types';

/**
 * C8: the answers behind the chosen template. Columns # · VCFO asked · The answer · So VCFO chose.
 * A missing answer is faint, never amber (P4). On phones each row stacks.
 */
export function EvidenceTable({ rows, result, className }: { rows: EvidenceRow[]; result?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 overflow-hidden rounded-md border-1.5 border-line bg-surface-raised', className)}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="hidden sm:table-header-group">
          <tr className="border-b-1.5 border-line bg-surface-sunken text-left text-[11px] font-medium uppercase tracking-[.06em] text-ink-muted">
            <th scope="col" className="h-9 w-11 px-3.5 font-medium">#</th>
            <th scope="col" className="h-9 px-3.5 font-medium">VCFO asked</th>
            <th scope="col" className="h-9 px-3.5 font-medium">The answer</th>
            <th scope="col" className="h-9 px-3.5 font-medium">So VCFO chose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 border-b border-line-soft px-3.5 py-2.5 last:border-b-0 sm:table-row sm:p-0">
              <td className="row-span-3 align-top sm:px-3.5 sm:py-2.5">
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-mark bg-brand-soft px-1.5 text-[11.5px] font-medium text-brand-text">{r.n}</span>
              </td>
              <td className="align-top text-ink-2 sm:px-3.5 sm:py-2.5">{r.asked}</td>
              <td className={cn('align-top font-medium sm:px-3.5 sm:py-2.5', r.missing ? 'text-ink-faint' : 'text-ink')}>{r.answer}</td>
              <td className="align-top text-ink-muted sm:px-3.5 sm:py-2.5 sm:text-ink-2">
                <span className="sm:hidden">So VCFO chose: </span>
                {r.chose}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {result ? <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-4 py-3 text-[13px] text-ink">{result}</div> : null}
    </div>
  );
}
