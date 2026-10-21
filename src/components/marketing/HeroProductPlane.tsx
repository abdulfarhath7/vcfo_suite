'use client';

import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

const STAGES = [
  { y: 160, label: 'Pre-inc', sub: 'Name · DSC · drafts' },
  { y: 320, label: 'Post-inc', sub: 'CIN · bank · setup' },
  { y: 480, label: 'Registrations', sub: 'GST · labour · MSME' },
  { y: 640, label: 'Ongoing', sub: 'Filings · vault' },
] as const;

/** Full-bleed hero visual: a flat brand spine with the four lifecycle stages. */
export function HeroProductPlane({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.35]);

  return (
    <m.div
      ref={ref}
      style={{ y, opacity }}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <svg
        className="absolute inset-y-0 right-0 h-full w-[min(110%,980px)] translate-x-[8%] sm:translate-x-[2%] lg:translate-x-0"
        viewBox="0 0 800 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[160, 260, 380].map((r, i) => (
          <circle
            key={r}
            cx="480"
            cy="400"
            r={r}
            className="stroke-brand"
            strokeOpacity={0.06 + i * 0.03}
            strokeWidth="1"
            fill="none"
          />
        ))}

        <m.path
          d="M480 48v804"
          className="stroke-brand"
          strokeOpacity="0.8"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />

        {STAGES.map((stage, i) => (
          <m.g
            key={stage.label}
            initial={reduce ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.14, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <circle cx="480" cy={stage.y} r={i === 1 ? 16 : 13} className="fill-brand" fillOpacity="0.2" />
            <circle cx="480" cy={stage.y} r={i === 1 ? 10 : 8} className="fill-brand" />
            <circle cx="480" cy={stage.y} r={i === 1 ? 4 : 3.25} className="fill-surface" />

            <path
              d={`M502 ${stage.y}h28`}
              className="stroke-brand"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            <text
              x="540"
              y={stage.y - 4}
              className="fill-ink"
              fillOpacity="0.92"
              style={{
                fontFamily: 'var(--font-serif), var(--font-sans), system-ui, sans-serif',
                fontSize: i === 2 ? 22 : 20,
                fontWeight: 600,
              }}
            >
              {stage.label}
            </text>
            <text
              x="540"
              y={stage.y + 16}
              className="fill-ink-muted"
              style={{
                fontFamily: 'var(--font-mono), ui-monospace, monospace',
                fontSize: 11,
                letterSpacing: '0.04em',
              }}
            >
              {stage.sub}
            </text>
          </m.g>
        ))}
      </svg>
    </m.div>
  );
}
