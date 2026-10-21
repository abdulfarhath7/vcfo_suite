'use client';

import Link from 'next/link';
import FadeContent from '@/components/marketing/react-bits/FadeContent';
import Magnet from '@/components/marketing/react-bits/Magnet';
import ShinyText from '@/components/marketing/react-bits/ShinyText';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export function LandingCta() {
  return (
    <section className="relative overflow-hidden bg-side px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      {/* Navy CTA band: the `side` tokens are the one fixed-dark surface in the system,
          so the copy stays light in both themes. */}
      <FadeContent
        blur
        className="relative z-10 mx-auto max-w-3xl rounded-xl border border-side-line bg-side-active px-6 py-12 text-center shadow-float sm:px-10 sm:py-16 lg:px-14"
      >
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]">
            <ShinyText text="Ready when you are" color="oklch(var(--side-muted))" speed={2.5} />
          </p>
          <h2 className="mx-auto mt-6 max-w-[18ch] font-serif text-[clamp(2.1rem,4.2vw,3.35rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-side-ink">
            Start every engagement with confidence.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-side-muted sm:text-base">
            Open your workspace or book a walkthrough — see how VCFO brings clarity to GCC filings, documents, and approvals.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Magnet padding={56} magnetStrength={2.6}>
              <Link
                href="/contact"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  // Inverted on navy: a brand fill would vanish against `side`.
                  'group min-w-[11rem] bg-side-ink text-side hover:bg-side-muted',
                )}
              >
                Request a demo
                <span className="ml-1 transition-transform group-hover:translate-x-0.5" aria-hidden>
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
