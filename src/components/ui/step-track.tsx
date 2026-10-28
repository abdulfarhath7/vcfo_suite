import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* VCFO Spectrum steps (ST5, rule R-22; prototype StepMark.tsx and PhaseBar.tsx). */

export type StepState = 'done' | 'now' | 'next';
export type StepTone = 'prog' | 'teal' | 'warn' | 'bad';

const RING: Record<StepTone, string> = {
  prog: 'shadow-[inset_0_0_0_1.5px_oklch(var(--brand)),0_0_0_4px_oklch(var(--brand-soft))]',
  teal: 'shadow-[inset_0_0_0_1.5px_oklch(var(--waiting-mid)),0_0_0_4px_oklch(var(--waiting-soft))]',
  warn: 'shadow-[inset_0_0_0_1.5px_oklch(var(--warning-mid)),0_0_0_4px_oklch(var(--warning-soft))]',
  bad: 'shadow-[inset_0_0_0_1.5px_oklch(var(--danger-mid)),0_0_0_4px_oklch(var(--danger-soft))]',
};
const DOT: Record<StepTone, string> = { prog: 'bg-brand', teal: 'bg-waiting-mid', warn: 'bg-warning-mid', bad: 'bg-danger-mid' };

/**
 * ST5 step marker, 22px. Done: a green square with a tick. Live: a ring with a square in the
 * status colour and a soft halo. Upcoming: a dashed square.
 */
export function StepMark({
  state,
  tone = 'prog',
  size = 22,
  className,
  label,
}: {
  state: StepState;
  tone?: StepTone;
  size?: 18 | 20 | 22;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-grid flex-none place-items-center rounded-mark',
        state === 'done' && 'bg-positive-mid text-white',
        state === 'now' && cn('bg-surface-raised', RING[tone]),
        state === 'next' && 'border-[1.5px] border-dashed border-line-strong',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {state === 'done' ? <Check size={size - 9} strokeWidth={2.6} /> : null}
      {state === 'now' ? <i className={cn('h-2 w-2 rounded-[2px]', DOT[tone])} /> : null}
    </span>
  );
}

/**
 * ST5 phase track: one bar per phase, sized by its step count. A finished phase is green, the
 * current phase is blurple with a soft ring, a later phase is grey. On phones and in client
 * lists this is the whole step view.
 */
export function PhaseBar({
  done,
  totals,
  names,
  className,
  tall = false,
}: {
  done: number[];
  totals: readonly number[];
  names?: string[];
  className?: string;
  /** 8px bars by default; `tall` draws the 10px home-card track. */
  tall?: boolean;
}) {
  const cur = totals.findIndex((t, i) => (done[i] ?? 0) < t);
  return (
    <span
      className={cn('flex min-w-[96px] items-center gap-1', tall ? 'h-2.5' : 'h-2', className)}
      role="img"
      aria-label={totals.map((t, i) => `${names?.[i] ?? `Phase ${i + 1}`} ${done[i] ?? 0} of ${t}`).join(', ')}
    >
      {totals.map((t, i) => {
        const pct = t > 0 ? Math.round(((done[i] ?? 0) / t) * 100) : 0;
        return (
          <span
            key={i}
            className={cn('relative h-full overflow-hidden rounded-bar bg-surface-sunken', i === cur && 'ring-[1.5px] ring-brand-line')}
            style={{ flex: Math.max(1, t) }}
            title={`${names?.[i] ?? `Phase ${i + 1}`} · ${done[i] ?? 0} of ${t}`}
          >
            <span
              className={cn('absolute inset-y-0 left-0 rounded-bar', pct === 100 ? 'bg-positive-mid' : 'bg-brand')}
              style={{ width: pct > 0 ? `max(${pct}%, 6px)` : 0 }}
            />
          </span>
        );
      })}
    </span>
  );
}
