'use client';

import { m, useReducedMotion } from 'framer-motion';
import { Calendar, CheckCircle2, FileCheck } from 'lucide-react';
import { staggerKids, fadeUp, fadeUpReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';

const SHOWCASE_TONES = {
  success: {
    card: 'border-l-success border-success/20 bg-success-light',
    iconShell: 'border-success/25 bg-white',
    icon: 'text-success-text',
  },
  info: {
    card: 'border-l-info border-info/20 bg-info-light',
    iconShell: 'border-info/25 bg-white',
    icon: 'text-info-text',
  },
  warning: {
    card: 'border-l-warning border-warning/20 bg-warning-light',
    iconShell: 'border-warning/25 bg-white',
    icon: 'text-warning-text',
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
                'flex items-center gap-2.5 rounded-lg border border-l-[3px] px-3 py-2 shadow-sm backdrop-blur-sm',
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
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.sub}</p>
              </div>
            </m.div>
          );
        })}
      </div>
    </m.div>
  );
}
