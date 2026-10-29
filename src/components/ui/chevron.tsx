import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** R-24: a plain 16px chevron, faint, no box. It turns 90° when open. */
export function Chevron({ open, className }: { open?: boolean; className?: string }) {
  return (
    <ChevronRight
      size={16}
      strokeWidth={1.6}
      aria-hidden
      className={cn('flex-none text-ink-faint transition-transform', open && 'rotate-90', className)}
    />
  );
}
