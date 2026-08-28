'use client';

import { m, useReducedMotion } from 'framer-motion';
import Aurora from '@/components/auth/react-bits/Aurora';
import BlurText from '@/components/auth/react-bits/BlurText';
import { LoginShowcase } from '@/components/auth/LoginShowcase';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { Eyebrow, GrainOverlay } from '@/components/noir';
import { springGentle } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface LoginHeroProps {
  className?: string;
  /** Compact strip for mobile top bar */
  variant?: 'full' | 'compact';
}

export function LoginHero({ className, variant = 'full' }: LoginHeroProps) {
  const reduceMotion = useReducedMotion();
  const isCompact = variant === 'compact';

  if (isCompact) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden border-b border-border bg-background px-4 py-4 sm:px-6 sm:py-5 md:px-10 md:py-8 lg:hidden',
          className,
        )}
      >
        <Aurora className="opacity-90" variant="light" />
        <GrainOverlay className="opacity-[0.08]" />
        <div className="relative z-10">
          <SbcLogo variant="lockup" size={32} decorative />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative hidden min-h-screen flex-col justify-between overflow-hidden bg-background p-10 lg:flex lg:p-12 xl:p-14',
        className,
      )}
    >
      <Aurora variant="light" />
      <GrainOverlay className="opacity-[0.08]" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(var(--background)/0.5)_100%)]"
        aria-hidden
      />

      <m.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springGentle}
        className="relative z-10"
      >
        <SbcLogo variant="lockup" size={40} decorative />
      </m.div>

      <div className="relative z-10 max-w-lg">
        <Eyebrow className="mb-5">For professional services firms</Eyebrow>
        <h1 className="login-hero-headline display-xl text-foreground">
          <BlurText
            text="Run every engagement"
            className="inline"
            delay={70}
            reducedMotion={reduceMotion ?? false}
          />{' '}
          <BlurText
            text="on record."
            className="inline text-primary"
            delay={70}
            reducedMotion={reduceMotion ?? false}
          />
        </h1>
        <LoginShowcase />
      </div>
    </div>
  );
}
