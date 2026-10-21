'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GradientTextProps = {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
};

/**
 * Brand-coloured inline text. The animated gradient sweep is gone (no
 * gradients on product or marketing surfaces); `colors` and `animationSpeed`
 * stay in the props so callers compile.
 */
export default function GradientText({ children, className = '' }: GradientTextProps) {
  return <span className={cn('inline-block text-brand', className)}>{children}</span>;
}
