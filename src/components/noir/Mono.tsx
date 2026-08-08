import { cn } from '@/lib/utils';

/** Monospace inline span — for refs, dates, amounts. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('mono', className)}>{children}</span>;
}
