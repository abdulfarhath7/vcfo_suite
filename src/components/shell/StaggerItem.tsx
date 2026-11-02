"use client";

import { m, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { fadeUp } from '@/lib/shell/motion';
import { useShellAppearance } from '@/hooks/use-shell-appearance';

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce } = useShellAppearance();
  if (osReduce || prefReduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <m.div className={className} variants={fadeUp}>
      {children}
    </m.div>
  );
}
