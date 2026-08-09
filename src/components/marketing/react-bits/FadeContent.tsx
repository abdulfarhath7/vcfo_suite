'use client';

import { type ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type FadeContentProps = {
  children: ReactNode;
  className?: string;
  blur?: boolean;
  duration?: number;
  delay?: number;
  y?: number;
};

/** React Bits FadeContent — framer whileInView (always settles to visible). */
export default function FadeContent({
  children,
  className = '',
  blur = false,
  duration = 0.7,
  delay = 0,
  y = 18,
}: FadeContentProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={cn(className)}
      initial={{ opacity: 0, y, filter: blur ? 'blur(8px)' : 'blur(0px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -40px 0px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
