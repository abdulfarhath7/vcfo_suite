import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Page layout helpers (prototype shell/Page): `Cols` is the main column with a 360px side column
 * from 1024px, `Col` stacks cards in one column, `Row` puts 2, 3 or 4 equal cards side by side,
 * `Stack` stacks cards. The gap is always 20px.
 */

export function Cols({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]', className)}>{children}</div>;
}

export function Col({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid min-w-0 grid-cols-1 gap-5', className)}>{children}</div>;
}

const ROW_COLS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 xl:grid-cols-4' } as const;

/** Equal columns. */
export function Row({ children, className, cols = 2 }: { children: ReactNode; className?: string; cols?: 2 | 3 | 4 }) {
  return <div className={cn('grid grid-cols-1 items-start gap-5', ROW_COLS[cols], className)}>{children}</div>;
}

export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-5', className)}>{children}</div>;
}
