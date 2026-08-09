'use client';

import { useRef, type ReactNode } from 'react';
import { m, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

type TiltCardProps = {
  children: ReactNode;
  className?: string;
};

/** Subtle 3D tilt on hover — product preview / bento tiles. */
export default function TiltCard({ children, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 220, damping: 24 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 220, damping: 24 });

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <m.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 900 }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </m.div>
  );
}
