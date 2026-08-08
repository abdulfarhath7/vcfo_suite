import { cn } from '@/lib/utils';

/** Optional subtle texture on light surfaces — keep opacity low. */
export function GrainOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 mix-blend-multiply opacity-25', className)}
      style={{
        backgroundImage:
          'radial-gradient(hsl(var(--foreground) / 0.035) 1px, transparent 1px), radial-gradient(hsl(var(--foreground) / 0.02) 1px, transparent 1px)',
        backgroundSize: '4px 4px, 8px 8px',
        backgroundPosition: '0 0, 2px 2px',
      }}
    />
  );
}
