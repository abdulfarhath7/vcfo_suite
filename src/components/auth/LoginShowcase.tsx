'use client';

import { m, useReducedMotion } from 'framer-motion';
import { Calendar, CheckCircle2, FileCheck } from 'lucide-react';
import { staggerKids, fadeUp, fadeUpReduced } from '@/lib/shell/motion';
import { cn } from '@/lib/utils';

/* Status cards: a soft ground, a hairline, a text-safe glyph. No coloured edges. */
const SHOWCASE_TONES = {
  success: {
    card: 'border-line bg-positive-soft',
    iconShell: 'border-line bg-surface-raised',
    icon: 'text-positive',
  },
  info: {
    card: 'border-line bg-info-soft',
    iconShell: 'border-line bg-surface-raised',
    icon: 'text-info',
  },
  warning: {
    card: 'border-line bg-warning-soft',
    iconShell: 'border-line bg-surface-raised',
    icon: 'text-warning',
  },
} as const;

const SHOWCASE_ITEMS = [
  {
    icon: CheckCircle2,
    label: '12 filings on track',
    sub: 'Portfolio health',
    tone: 'success' as const,
  },
  {
    icon: FileCheck,
    label: 'Phase 2 · Director KYC',
    sub: 'Awaiting client upload',
    tone: 'info' as const,
  },
  {
    icon: Calendar,
    label: 'MCA deadline in 6 days',
    sub: 'INC-9 · Registration',
    tone: 'warning' as const,
  },
] as const;

export function LoginShowcase({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      className={cn('login-hero-showcase relative z-10 mt-5 hidden max-w-md lg:block', className)}
      variants={reduceMotion ? fadeUpReduced : staggerKids(0.12, 0.2)}
      initial="hidden"
      animate="show"
      aria-hidden
    >
      <div className="space-y-2">
        {SHOWCASE_ITEMS.map((item, i) => {
          const tone = SHOWCASE_TONES[item.tone];
          return (
            <m.div
              key={item.label}
              variants={reduceMotion ? fadeUpReduced : fadeUp}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: [0, -4, 0],
                      transition: {
                        duration: 4 + i * 0.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.4,
                      },
                    }
              }
              className={cn(
                'flex items-center gap-2.5 rounded-md border px-3 py-2 shadow-card',
                tone.card,
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                  tone.iconShell,
                )}
              >
                <item.icon className={cn('h-4 w-4', tone.icon)} strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{item.label}</p>
                <p className="text-[11px] text-ink-muted">{item.sub}</p>
              </div>
            </m.div>
          );
        })}
      </div>
    </m.div>
  );
}
