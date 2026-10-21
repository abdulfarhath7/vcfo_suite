import { cn } from '@/lib/utils';

export function GoldDivider({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div
        className={cn('w-px self-stretch', className)}
        style={{
          background:
            'oklch(var(--brand) / 0.5)',
        }}
        aria-hidden
      />
    );
  }
  return <div className={cn('gold-rule', className)} aria-hidden />;
}
