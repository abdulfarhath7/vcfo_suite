'use client';

import Link from 'next/link';
import Aurora from '@/components/auth/react-bits/Aurora';
import { HeroProductPlane } from '@/components/marketing/HeroProductPlane';
import Magnet from '@/components/marketing/react-bits/Magnet';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export function LandingHero() {
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-surface">
      {/* The one brand-soft wash on the landing page. */}
      <Aurora className="opacity-50" variant="light" />
      <HeroProductPlane />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="max-w-[36rem]">
          <p className="discrete-hero-enter discrete-delay-1 font-serif text-[clamp(2.85rem,6.8vw,4.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-ink">
            VCFO
          </p>
          <p className="discrete-hero-enter discrete-delay-1 mt-2 font-mono text-[11px] uppercase tracking-[0.28em] text-brand">
            Suite · GCC compliance cockpit
          </p>

          <div className="discrete-hero-rule discrete-delay-2 mt-8 h-px w-16 bg-brand" />

          <h1 className="discrete-hero-enter discrete-delay-2 mt-8 font-serif text-[clamp(1.7rem,3.8vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
            Engagements that feel precise — from intake to filing.
          </h1>

          <p className="discrete-hero-enter discrete-delay-3 mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted sm:text-base">
            One workspace for GCC setup, client reviews, and firm approvals — built for Indian professional services.
          </p>

          <div className="discrete-hero-enter discrete-delay-4 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnet padding={48} magnetStrength={2.6}>
              <Link href="/login" className={cn(buttonVariants({ size: 'lg' }), 'group')}>
                Launch workspace
                <span className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                  →
                </span>
              </Link>
            </Magnet>
            <Link href="/contact" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              Request demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
