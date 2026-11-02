'use client';

import { cn } from '@/lib/utils';

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
};

/**
 * Flat text. The metallic sheen was a text-clipped gradient, which the
 * token rules forbid; `disabled`, `speed` and `shineColor` are accepted so
 * existing call sites compile, and `color` is the one thing that still applies.
 */
export default function ShinyText({ text, className = '', color = 'oklch(var(--ink-muted))' }: ShinyTextProps) {
  return (
    <span className={cn('inline-block', className)} style={{ color }}>
      {text}
    </span>
  );
}
