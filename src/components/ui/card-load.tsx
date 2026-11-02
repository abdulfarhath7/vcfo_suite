import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** One grey shape. It pulses, and stops under reduced motion. */
const BAR = 'block animate-pulse rounded-bar bg-line motion-reduce:animate-none';

/**
 * L1 loading shapes (VCFO Spectrum B-19, prototype `CardLoad`): grey shapes of the content, not a
 * spinner. `variant="rows"` draws list rows (a tile, two lines and a 104px chip); `"block"` draws a
 * summary (a tile with two lines, two full lines and three chips). Screen readers hear "Loading" once.
 */
export function CardLoad({ variant = 'block', rows = 4, className }: { variant?: 'rows' | 'block'; rows?: number; className?: string }) {
  return (
    <div className={cn('min-w-0', className)} role="status" aria-label="Loading">
      {variant === 'rows' ? (
        Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line-soft py-3 first:border-t-0" aria-hidden>
            <span className={cn(BAR, 'h-7 w-7 flex-none rounded-md')} />
            <span className="grid min-w-0 flex-1 gap-1.5">
              <span className={cn(BAR, 'h-3 w-3/5')} />
              <span className={cn(BAR, 'h-2.5 w-2/5')} />
            </span>
            <span className={cn(BAR, 'hidden h-6 w-[104px] flex-none rounded-md sm:block')} />
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-3.5 py-1" aria-hidden>
          <div className="flex items-center gap-3">
            <span className={cn(BAR, 'h-9 w-9 flex-none rounded-md')} />
            <span className="flex flex-1 flex-col gap-2">
              <span className={cn(BAR, 'h-3 w-3/5')} />
              <span className={cn(BAR, 'h-2.5 w-[35%]')} />
            </span>
          </div>
          <span className={cn(BAR, 'h-2.5 w-full')} />
          <span className={cn(BAR, 'h-2.5 w-[85%]')} />
          <div className="flex gap-2.5">
            <span className={cn(BAR, 'h-6 w-[104px] rounded-md')} />
            <span className={cn(BAR, 'h-6 w-[104px] rounded-md')} />
            <span className={cn(BAR, 'h-6 w-20 rounded-md')} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A card body that shows L1 shapes while `loading` is true. The real content stays mounted (its
 * state, focus and size are kept) but hidden, and the shapes cover it. Pass the real loading flag
 * from the query; there is no fake delay.
 */
export function CardLoadBody({
  loading,
  variant = 'block',
  rows,
  className,
  children,
}: {
  loading?: boolean;
  variant?: 'rows' | 'block';
  rows?: number;
  className?: string;
  children?: ReactNode;
}) {
  // One tree in both states, so the content is not remounted when loading ends.
  return (
    <div className={cn(loading && 'relative min-h-[120px]', className)} aria-busy={loading || undefined}>
      <div className={loading ? 'invisible' : 'contents'} aria-hidden={loading || undefined}>
        {children}
      </div>
      {loading ? (
        <div className="absolute inset-0 z-[1] overflow-hidden bg-surface-raised [padding:inherit]">
          <CardLoad variant={variant} rows={rows} />
        </div>
      ) : null}
    </div>
  );

}
