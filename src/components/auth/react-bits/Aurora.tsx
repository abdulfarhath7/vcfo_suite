'use client';

import { cn } from '@/lib/utils';

interface AuroraProps {
  className?: string;
  /** Kept for callers: both variants now render the same flat brand-soft wash. */
  variant?: 'light' | 'dark';
}

/**
 * Flat brand-soft wash (docs/design/TOKENS.md: no gradients, no blur). The old
 * animated gradient aurora is gone; the export and props stay so every
 * hero keeps compiling. Callers set the opacity, and at most one wash per page.
 */
export default function Aurora({ className, variant = 'dark' }: AuroraProps) {
  return (
    <div
      data-variant={variant}
      className={cn('pointer-events-none absolute inset-0 bg-brand-soft', className)}
      aria-hidden
    />
  );
}
