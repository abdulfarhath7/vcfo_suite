'use client';

import { RevealChild } from '@/components/marketing/Reveal';

const SIGNALS = [
  'MCA-ready workflows',
  'Secure document vault',
  'Role-based access',
  'Audit-ready trail',
] as const;

export function LandingTrust() {
  return (
    <section className="relative border-t border-border/40 bg-background py-16 sm:py-18">
      <RevealChild className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col items-center gap-8 sm:gap-10">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Trusted by incorporation teams and professional firms
          </p>
          <ul className="flex w-full flex-wrap items-center justify-center gap-x-0 gap-y-4 sm:gap-x-6">
            {SIGNALS.map((label, i) => (
              <li key={label} className="flex items-center">
                {i > 0 ? (
                  <span
                    className="mx-4 hidden h-3 w-px bg-border sm:mx-6 sm:block"
                    aria-hidden
                  />
                ) : null}
                <span className="px-3 font-mono text-[11px] tracking-[0.06em] text-foreground/75 sm:px-0 sm:text-xs">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </RevealChild>
    </section>
  );
}
