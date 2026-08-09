'use client';

import { useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
};

/** React Bits SpotlightCard — light Editorial Noir surface + orange spotlight. */
export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(234, 88, 12, 0.18)',
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/70 bg-[oklch(var(--panel))] p-6 sm:p-7',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out"
        style={{
          opacity,
          background: `radial-gradient(420px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 55%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
