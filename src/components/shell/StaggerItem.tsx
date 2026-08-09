"use client";

import { m, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { fadeUp, fadeUpReduced } from '@/lib/motion';

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <m.div className={className} variants={fadeUp}>
      {children}
    </m.div>
  );
}
