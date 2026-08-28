'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { m as motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = {
  value: T;
  /** Text, or a node for icon/count labels. */
  label: ReactNode;
};

type PillRect = { left: number; top: number; width: number; height: number };

/**
 * One highlight slides between options — the control the starting-phase picker
 * introduced, extracted so entity origin, legal form, and the questionnaire's
 * Yes/No rows all move the same way.
 */
export function SegmentedPicker<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  labelledBy,
  columns,
  size = 'md',
  className,
}: {
  value: T | null;
  options: readonly SegmentedOption<T>[];
  onChange: (next: T) => void;
  ariaLabel?: string;
  labelledBy?: string;
  /** Force a column count; defaults to one column per option. */
  columns?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<PillRect | null>(null);
  const activeIndex = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const btn = activeIndex >= 0 ? btnRefs.current[activeIndex] : null;
    if (!track || !btn) {
      setPill(null);
      return;
    }
    const trackBox = track.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    setPill({
      left: btnBox.left - trackBox.left,
      top: btnBox.top - trackBox.top,
      width: btnBox.width,
      height: btnBox.height,
    });
  }, [activeIndex, value, options.length, columns, size]);

  useEffect(() => {
    const remeasure = () => {
      const track = trackRef.current;
      const btn = activeIndex >= 0 ? btnRefs.current[activeIndex] : null;
      if (!track || !btn) return;
      const trackBox = track.getBoundingClientRect();
      const btnBox = btn.getBoundingClientRect();
      setPill({
        left: btnBox.left - trackBox.left,
        top: btnBox.top - trackBox.top,
        width: btnBox.width,
        height: btnBox.height,
      });
    };
    window.addEventListener('resize', remeasure);
    const ro =
      typeof ResizeObserver !== 'undefined' && trackRef.current
        ? new ResizeObserver(remeasure)
        : null;
    if (trackRef.current && ro) ro.observe(trackRef.current);
    return () => {
      window.removeEventListener('resize', remeasure);
      ro?.disconnect();
    };
  }, [activeIndex]);

  const cols = columns ?? options.length;

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      className={cn(
        'relative grid gap-1 rounded-lg bg-muted/40 p-1 ring-1 ring-border/80',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {pill ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-0 rounded-md bg-primary shadow-sm"
          initial={false}
          animate={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }}
          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
        />
      ) : null}

      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative z-[1] inline-flex items-center justify-center gap-1.5 rounded-md text-center font-medium transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'px-2 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]',
              active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
