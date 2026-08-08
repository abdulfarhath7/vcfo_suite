'use client';

import { m, useReducedMotion } from 'framer-motion';
import Aurora from '@/components/auth/react-bits/Aurora';
import BlurText from '@/components/auth/react-bits/BlurText';
import { LoginShowcase } from '@/components/auth/LoginShowcase';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { Eyebrow, GoldDivider, GrainOverlay, Mono, TrustBadge } from '@/components/noir';
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
          <div className="flex items-center gap-3">
            <SbcLogo variant="mark" size={40} decorative />
            <div className="min-w-0">
              <div className="text-[13px] font-medium tracking-tight text-foreground sm:text-[14px]">VCFO Suite</div>
              <Eyebrow className="mt-0.5">Compliance workspace</Eyebrow>
            </div>
          </div>
          <div className="login-hero-compact-extra mt-0 hidden md:mt-6 md:block">
            <Eyebrow className="mb-3">For professional services firms</Eyebrow>
            <p className="max-w-xl text-[clamp(22px,4vw,32px)] font-serif leading-tight text-foreground">
              Run every engagement <em className="not-italic text-orange-600">on record.</em>
            </p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Tasks, filings, and client collaboration on one timeline built for Indian compliance.
            </p>
          </div>
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
        className="relative z-10 flex items-center gap-3"
      >
        <SbcLogo variant="mark" size={40} decorative />
        <div>
          <div className="text-[14px] font-medium tracking-tight text-foreground">VCFO Suite</div>
          <Eyebrow className="mt-0.5">Compliance workspace</Eyebrow>
        </div>
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
            className="inline text-orange-600"
            delay={70}
            reducedMotion={reduceMotion ?? false}
          />
        </h1>
        <GoldDivider className="my-7 max-w-[80px]" />
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground prose-narrow">
          From GCC intake through filing — tasks, document requests, phase deadlines, and client uploads on one
          timeline built for Indian compliance.
        </p>
        <p className="login-hero-subcopy mt-4 max-w-sm text-xs text-muted-foreground">
          Your data stays on record with VCFO. Clients see only what you share — managers keep full portfolio
          visibility.
        </p>
        <TrustBadge className="login-hero-trust mt-6">Encrypted sign-in · role-based access</TrustBadge>
        <LoginShowcase />
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
        <Mono>SOC&nbsp;2–ready</Mono>
        <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
        <Mono>India·MCA·RBI native</Mono>
        <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
        <Mono>Multi-tenant</Mono>
      </div>
    </div>
  );
}
