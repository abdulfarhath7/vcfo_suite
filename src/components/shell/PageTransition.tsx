"use client";

import { m, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { pageEnter, pageEnterAmbient, pageEnterDynamic, pageEnterReduced } from '@/lib/motion';
import { useShellAppearance } from '@/lib/use-shell-appearance';

export { Stagger } from '@/components/shell/Stagger';
export { StaggerItem } from '@/components/shell/StaggerItem';

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce, motion } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const preset = reduceMotion
    ? pageEnterReduced
    : motion === 'dynamic'
      ? pageEnterDynamic
      : motion === 'ambient'
        ? pageEnterAmbient
        : motion === 'minimal' || motion === 'none'
          ? pageEnterReduced
          : pageEnter;

  return (
    <m.div
      className={className}
      initial={preset.initial}
      animate={preset.animate}
      exit={preset.exit}
      transition={preset.transition}
    >
      {children}
    </m.div>
  );
}
