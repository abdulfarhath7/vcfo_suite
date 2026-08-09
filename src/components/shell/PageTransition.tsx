"use client";

import { m, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { pageEnter, pageEnterReduced } from '@/lib/motion';

export { Stagger } from '@/components/shell/Stagger';
export { StaggerItem } from '@/components/shell/StaggerItem';

export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const preset = reduceMotion ? pageEnterReduced : pageEnter;

  if (reduceMotion) {
    return (
      <m.div initial={preset.initial} animate={preset.animate} exit={preset.exit} transition={preset.transition}>
        {children}
      </m.div>
    );
  }

  return (
    <m.div
      initial={preset.initial}
      animate={preset.animate}
      exit={preset.exit}
      transition={preset.transition}
    >
      {children}
    </m.div>
  );
}
