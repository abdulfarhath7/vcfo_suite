import { cn } from '@/lib/utils';

export function GoldDivider({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div
        className={cn('w-px self-stretch', className)}
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, oklch(var(--blue-400) / 0.4) 20%, oklch(var(--blue-400) / 0.4) 80%, transparent 100%)',
        }}
        aria-hidden
      />
    );
  }
  return <div className={cn('gold-rule', className)} aria-hidden />;
}
