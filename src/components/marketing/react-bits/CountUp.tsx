'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

type CountUpProps = {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
  separator?: string;
  suffix?: string;
  prefix?: string;
};

/** React Bits CountUp — spring counter via framer-motion. */
export default function CountUp({
  to,
  from = 0,
  duration = 1.6,
  className = '',
  separator = ',',
  suffix = '',
  prefix = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, {
    damping: 28,
    stiffness: 90 / Math.max(duration, 0.4),
  });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const formatValue = useCallback(
    (latest: number) => {
      const rounded = Math.round(latest);
      const formatted = separator
        ? Intl.NumberFormat('en-US').format(rounded).replace(/,/g, separator)
        : String(rounded);
      return `${prefix}${formatted}${suffix}`;
    },
    [prefix, separator, suffix],
  );

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(from);
  }, [from, formatValue]);

  useEffect(() => {
    if (isInView) motionValue.set(to);
  }, [isInView, motionValue, to]);

  useEffect(() => {
    const unsub = springValue.on('change', (latest) => {
      if (ref.current) ref.current.textContent = formatValue(latest);
    });
    return () => unsub();
  }, [springValue, formatValue]);

  return <span ref={ref} className={cn('tabular-nums', className)} />;
}
