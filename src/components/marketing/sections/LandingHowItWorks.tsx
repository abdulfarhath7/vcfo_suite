'use client';

import { Reveal, RevealChild, RevealItem } from '@/components/marketing/Reveal';
import { Eyebrow } from '@/components/noir';

const PHASES = [
  {
    n: '01',
    title: 'Capture',
    body: 'Collect founder data, documents and approvals once, with prompts tuned for GCC and MCA filings.',
  },
  {
    n: '02',
    title: 'Coordinate',
    body: 'Keep leads, managers and clients aligned on a shared engagement thread with real-time status.',
  },
  {
    n: '03',
    title: 'Complete',
    body: 'Deliver filing-ready output and client signoff in a single workflow that closes the loop.',
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden border-t border-line bg-surface-sunken py-16 sm:py-18 lg:py-20"
    >
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <Reveal className="max-w-2xl" stagger>
          <RevealItem>
            <Eyebrow>How it works</Eyebrow>
            <div className="mt-4 h-px w-12 bg-brand" />
            <h2 className="mt-5 font-serif text-[clamp(1.95rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">
              One engagement thread for incorporation, licensing, and filings.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-[1.75] text-ink-muted sm:text-base">
              VCFO Suite flows through the full GCC lifecycle, with checkpoints and approvals built for firm operations.
            </p>
          </RevealItem>
        </Reveal>

        <ol className="relative mt-12 sm:mt-14">
          <div
            className="absolute bottom-2 left-[0.85rem] top-2 w-px bg-line-strong sm:left-[1.15rem]"
            aria-hidden
          />

          {PHASES.map((phase, i) => (
            <RevealChild
              key={phase.n}
              as="li"
              delayClass={`discrete-delay-${Math.min(i + 1, 5)}`}
              className="relative grid grid-cols-[2rem_1fr] gap-4 py-6 sm:grid-cols-[3rem_1fr] sm:gap-8 sm:py-7"
            >
              <div className="relative z-10 flex justify-center pt-1.5">
                <span
                  className="mkt-timeline-node flex h-4 w-4 items-center justify-center rounded-sm bg-brand shadow-[0_0_0_6px_oklch(var(--surface-sunken)),0_0_0_7px_oklch(var(--line))]"
                  style={{ animationDelay: `${i * 0.35}s` }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-[2px] bg-on-brand"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  />
                </span>
              </div>
              <div
                className={`min-w-0 ${i < PHASES.length - 1 ? 'border-b border-line pb-6 sm:pb-7' : ''}`}
              >
                <p className="font-mono text-[11px] tracking-[0.16em] text-brand">
                  {phase.n}
                </p>
                <h3 className="mt-1.5 font-serif text-[1.4rem] font-medium tracking-tight text-ink sm:text-[1.6rem]">
                  {phase.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-[15px]">
                  {phase.body}
                </p>
              </div>
            </RevealChild>
          ))}
        </ol>
      </div>
    </section>
  );
}
