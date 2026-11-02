import { cn } from '@/lib/utils';

/** Bar tones (prototype ui/Bar): status colours for the fill. */
export type ProgressTone = 'accent' | 'ok' | 'warn' | 'bad' | 'violet' | 'teal' | 'idle' | 'navy';

const FILL: Record<ProgressTone, string> = {
  accent: 'bg-brand',
  ok: 'bg-positive-mid',
  warn: 'bg-warning-mid',
  bad: 'bg-danger-mid',
  violet: 'bg-identity-mid',
  teal: 'bg-waiting-mid',
  idle: 'bg-upcoming-mid',
  navy: 'bg-navy',
};

const HEIGHT = { 6: 'h-1.5', 8: 'h-2', 10: 'h-2.5' } as const;

interface Props {
  /** 0 to 100. */
  value: number;
  /** Fill tone; blurple by default. */
  tone?: ProgressTone;
  /** Bar height in px: 6 (default), 8 or 10. */
  size?: keyof typeof HEIGHT;
  className?: string;
  /** Accessible name; without it the bar is decoration. */
  label?: string;
}

/** Progress bar (prototype Bar): a 3px-corner bar on the raised track, in one of eight tones. */
export function ProgressBar({ value, tone = 'accent', size = 6, className, label }: Props) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-bar bg-surface-sunken', HEIGHT[size], className)}
      {...(label
        ? { role: 'progressbar', 'aria-label': label, 'aria-valuenow': Math.round(v), 'aria-valuemin': 0, 'aria-valuemax': 100 }
        : { 'aria-hidden': true })}
    >
      <div className={cn('h-full rounded-bar transition-[width]', FILL[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}
