"use client";

import { m, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { listStagger, staggerKids } from '@/lib/motion';

export function Stagger({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div>{children}</div>;
  }
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={staggerKids(listStagger.staggerChildren, delay || listStagger.delayChildren)}
    >
      {children}
    </m.div>
  );
}
