'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GradientTextProps = {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
};

/** React Bits–style gradient sweep text (brand orange defaults). */
export default function GradientText({
  children,
  className = '',
  colors = ['#EA580C', '#FB923C', '#C2410C', '#FDBA74'],
  animationSpeed = 6,
}: GradientTextProps) {
  const gradientColors = [...colors, colors[0]].join(', ');

  return (
    <span
      className={cn('inline-block bg-clip-text text-transparent', className)}
      style={
        {
          backgroundImage: `linear-gradient(90deg, ${gradientColors})`,
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          animation: `mkt-gradient-shift ${animationSpeed}s ease infinite`,
        } as React.CSSProperties
      }
    >
      {children}
    </span>
  );
}
