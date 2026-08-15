'use client';

import Link from 'next/link';
import Aurora from '@/components/auth/react-bits/Aurora';
import { GrainOverlay } from '@/components/noir';
import { HeroProductPlane } from '@/components/marketing/HeroProductPlane';
import Magnet from '@/components/marketing/react-bits/Magnet';

export function LandingHero() {
  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden bg-[oklch(var(--background))]">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 80% at 78% 12%, oklch(var(--blue-100) / 0.7), transparent 58%),
            radial-gradient(ellipse 70% 50% at 8% 88%, oklch(var(--blue-50) / 0.85), transparent 52%),
            linear-gradient(165deg, oklch(var(--background)) 0%, oklch(var(--raised)) 100%)
          `,
        }}
      />

      <Aurora className="opacity-50" variant="light" />
      <GrainOverlay className="opacity-[0.04]" />
      <HeroProductPlane />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="max-w-[36rem]">
          <p className="discrete-hero-enter discrete-delay-1 font-serif text-[clamp(2.85rem,6.8vw,4.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-foreground">
            VCFO
          </p>
          <p className="discrete-hero-enter discrete-delay-1 mt-2 font-mono text-[11px] uppercase tracking-[0.28em] text-blue-600">
            Suite · GCC compliance cockpit
          </p>

          <div className="discrete-hero-rule discrete-delay-2 mt-8 h-px w-16 bg-gradient-to-r from-blue-600 to-transparent" />

          <h1 className="discrete-hero-enter discrete-delay-2 mt-8 font-serif text-[clamp(1.7rem,3.8vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground">
            Engagements that feel precise — from intake to filing.
          </h1>

          <p className="discrete-hero-enter discrete-delay-3 mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            One workspace for GCC setup, client reviews, and firm approvals — built for Indian professional services.
          </p>

          <div className="discrete-hero-enter discrete-delay-4 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnet padding={48} magnetStrength={2.6}>
              <Link
                href="/login"
                className="gold-sheen group inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-semibold tracking-tight shadow-layered transition-[filter,transform] hover:brightness-105 active:translate-y-px"
              >
                Launch workspace
                <span className="ml-2.5 inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                  →
                </span>
              </Link>
            </Magnet>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border/80 bg-panel/80 px-6 text-sm font-medium tracking-tight text-foreground backdrop-blur-sm transition-colors hover:border-blue-300 hover:bg-blue-50/70"
            >
              Request demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
