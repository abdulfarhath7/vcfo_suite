'use client';

import Link from 'next/link';
import { GrainOverlay } from '@/components/noir';
import FadeContent from '@/components/marketing/react-bits/FadeContent';
import Magnet from '@/components/marketing/react-bits/Magnet';
import ShinyText from '@/components/marketing/react-bits/ShinyText';

export function LandingCta() {
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      {/* Fixed-dark CTA panel (copy is hardcoded white) — base gradient uses navy-slate
          literals in the brand hue rather than surface vars, which invert in light theme. */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 15% 20%, oklch(var(--orange-600) / 0.28), transparent 42%),
            radial-gradient(circle at 85% 80%, oklch(var(--orange-400) / 0.16), transparent 40%),
            linear-gradient(165deg, oklch(18% 0.015 255), oklch(14% 0.014 255))
          `,
        }}
      />
      <GrainOverlay className="opacity-[0.07] mix-blend-soft-light" />

      <FadeContent
        blur
        className="relative z-10 mx-auto max-w-3xl rounded-[2rem] border border-white/12 bg-white/[0.04] px-6 py-12 text-center shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:px-10 sm:py-16 lg:px-14"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top,oklch(var(--orange-500)/0.22),transparent_48%)]"
          aria-hidden
        />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-hi/80">
            <ShinyText
              text="Ready when you are"
              color="oklch(var(--gold-hi))"
              shineColor="#ffffff"
              speed={2.5}
            />
          </p>
          <h2 className="mx-auto mt-6 max-w-[18ch] font-serif text-[clamp(2.1rem,4.2vw,3.35rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Start every engagement with confidence.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/65 sm:text-base">
            Open your workspace or book a walkthrough — see how VCFO brings clarity to GCC filings, documents, and approvals.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Magnet padding={56} magnetStrength={2.6}>
              <Link
                href="/contact"
                className="gold-sheen group inline-flex h-12 min-w-[11rem] items-center justify-center rounded-full px-7 text-sm font-semibold tracking-tight shadow transition-[filter,transform] hover:brightness-105 active:translate-y-px"
              >
                Request a demo
                <span className="ml-2 transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </Link>
            </Magnet>
          </div>
        </div>
      </FadeContent>
    </section>
  );
}
