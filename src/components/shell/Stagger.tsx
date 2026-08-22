"use client";

import { m, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { listStagger, staggerKids } from '@/lib/motion';
import { useShellAppearance } from '@/lib/use-shell-appearance';

export function Stagger({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce } = useShellAppearance();
  if (osReduce || prefReduce) {
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
