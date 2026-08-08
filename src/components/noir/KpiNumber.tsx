'use client';

import { useEffect, useRef, useState } from 'react';
import { m, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KpiNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

/** Big serif KPI number with a graceful count-up on enter. */
export function KpiNumber({
  value,
  suffix,
  prefix,
  decimals = 0,
  className,
  duration = 1100,
}: KpiNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / duration);
      // ease-out-quart
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <m.span
      ref={ref}
      className={cn('serif text-role-foreground inline-flex items-baseline tabular-nums', className)}
      style={{ fontSize: 'clamp(34px, 4vw, 48px)', lineHeight: 1 }}
    >
      {prefix && <span className="text-paper-muted mr-1 text-[0.5em]">{prefix}</span>}
      {formatted}
      {suffix && <span className="text-paper-muted ml-1 text-[0.5em]">{suffix}</span>}
    </m.span>
  );
}
