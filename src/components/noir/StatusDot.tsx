import { cn } from '@/lib/utils';

export type DotTone = 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const toneMap: Record<DotTone, string> = {
  gold: 'bg-gold shadow-[0_0_8px_oklch(var(--gold)/0.6)]',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  muted: 'bg-paper-subtle',
};

export function StatusDot({
  tone = 'gold',
  pulse = false,
  className,
  size = 8,
}: {
  tone?: DotTone;
  pulse?: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        toneMap[tone],
        pulse && 'animate-gold-pulse',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
