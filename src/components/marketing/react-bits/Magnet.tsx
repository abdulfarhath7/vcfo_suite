'use client';

import { useEffect, useRef, useState, type ReactNode, type HTMLAttributes } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type MagnetProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  wrapperClassName?: string;
  innerClassName?: string;
};

/** React Bits Magnet — cursor attraction with spring-ish CSS ease. */
export default function Magnet({
  children,
  padding = 60,
  disabled = false,
  magnetStrength = 3.2,
  wrapperClassName = '',
  innerClassName = '',
  ...props
}: MagnetProps) {
  const reduce = useReducedMotion();
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const magnetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled || reduce) {
      setPosition({ x: 0, y: 0 });
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!magnetRef.current) return;
      const { left, top, width, height } = magnetRef.current.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const distX = Math.abs(centerX - e.clientX);
      const distY = Math.abs(centerY - e.clientY);

      if (distX < width / 2 + padding && distY < height / 2 + padding) {
        setIsActive(true);
        setPosition({
          x: (e.clientX - centerX) / magnetStrength,
          y: (e.clientY - centerY) / magnetStrength,
        });
      } else {
        setIsActive(false);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [padding, disabled, magnetStrength, reduce]);

  return (
    <div
      ref={magnetRef}
      className={cn('relative inline-block', wrapperClassName)}
      {...props}
    >
      <div
        className={innerClassName}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isActive ? 'transform 0.22s ease-out' : 'transform 0.45s ease-in-out',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
