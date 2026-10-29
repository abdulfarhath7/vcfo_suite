import { cn } from '@/lib/utils';

/**
 * C4 "On time vs late" (VCFO Spectrum B-23; prototype `src/components/cards/OnTimeColumns.tsx`):
 * one stacked column per month, the green on-time part at the base and the red late part on top
 * with rounded top corners, over three faint guide lines. Status colours only (R-25). Used on the
 * staff Filings rail and on Analytics › Filings on time, so both read the same.
 */

export interface OnTimeColumn {
  key?: string;
  label: string;
  onTime: number;
  late: number;
}

export function OnTimeColumns({ data, height = 146, className }: { data: OnTimeColumn[]; height?: number; className?: string }) {
  const max = Math.max(1, ...data.map((m) => m.onTime + m.late));
  const px = (n: number) => Math.round((n / max) * height);
  const summary = data.map((m) => `${m.label}: ${m.onTime} on time, ${m.late} late`).join('; ');
  const many = data.length > 6;
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex gap-4 text-[12.5px] text-ink-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-[2px] bg-positive-mid" />
          On time
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-[2px] bg-danger-mid" />
          Late
        </span>
      </div>
      <div className="relative" role="img" aria-label={`On time vs late by month. ${summary}.`}>
        {[0, Math.round(height / 2), height].map((top) => (
          <span key={top} className="absolute inset-x-0 h-px bg-line-soft" style={{ top }} aria-hidden />
        ))}
        <div className={cn('relative z-[1] flex items-end', many ? 'gap-1 sm:gap-2.5' : 'gap-3.5')}>
          {data.map((m) => (
            <div key={m.key ?? m.label} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${m.label} · ${m.onTime} on time · ${m.late} late`}>
              <div className="flex w-full max-w-[36px] flex-col justify-end gap-0.5" style={{ height }}>
                {m.late > 0 ? <span className="rounded-t-bar bg-danger-mid" style={{ height: Math.max(2, px(m.late)) }} /> : null}
                {m.onTime > 0 ? (
                  <span className={cn('bg-positive-mid', m.late > 0 ? 'rounded-b-[2px]' : 'rounded-t-bar')} style={{ height: px(m.onTime) }} />
                ) : null}
              </div>
              <span className="text-[12px] text-ink-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
