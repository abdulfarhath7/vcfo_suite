'use client';

import { ArrowDown, ArrowRight } from 'lucide-react';
import FadeContent from '@/components/marketing/react-bits/FadeContent';
import TiltCard from '@/components/marketing/react-bits/TiltCard';
import GradientText from '@/components/marketing/react-bits/GradientText';
import { Eyebrow, Mono } from '@/components/noir';

const TILES = [
  {
    title: 'Collect',
    body: 'Capture documents, founder details, and approvals in one place so nothing falls through the cracks.',
    mono: 'STAGE 01',
  },
  {
    title: 'File',
    body: 'Turn tracked work into filing-ready output with status visible to every stakeholder.',
    mono: 'STAGE 02',
  },
  {
    title: 'Close',
    body: 'Share final approvals and client signoff on the same engagement timeline.',
    mono: 'STAGE 03',
  },
] as const;

function FlowArrow({ delay = 0, vertical = false }: { delay?: number; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex items-center justify-center py-1" aria-hidden>
        <div
          className="mkt-flow-arrow-down flex flex-col items-center text-orange-600"
          style={{ animationDelay: `${delay}s` }}
        >
          <svg width="2" height="18" className="overflow-visible">
            <line
              x1="1"
              y1="0"
              x2="1"
              y2="18"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mkt-flow-dash"
              style={{ animationDelay: `${delay}s` }}
            />
          </svg>
          <ArrowDown className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute left-full top-1/2 z-20 hidden -translate-y-1/2 items-center md:flex"
      style={{ width: '1.5rem', marginLeft: '-0.15rem' }}
      aria-hidden
    >
      <div
        className="mkt-flow-arrow flex items-center text-indigo-600"
        style={{ animationDelay: `${delay}s` }}
      >
        <svg width="18" height="2" className="overflow-visible">
          <line
            x1="0"
            y1="1"
            x2="18"
            y2="1"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mkt-flow-dash"
            style={{ animationDelay: `${delay}s` }}
          />
        </svg>
        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      </div>
    </div>
  );
}

export function LandingWorkflow() {
  return (
    <section className="relative border-t border-border/40 bg-[oklch(var(--raised))] py-16 sm:py-20">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-orange-200/25 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <FadeContent blur className="max-w-2xl">
          <Eyebrow>Workflow</Eyebrow>
          <div className="mt-5 h-px w-12 bg-gradient-to-r from-indigo-500 to-transparent" />
          <h2 className="mt-7 font-serif text-[clamp(2rem,4vw,2.85rem)] font-medium leading-[1.08] tracking-[-0.02em] text-foreground">
            From intake to approval —{' '}
            <GradientText className="font-serif">without losing the thread.</GradientText>
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.7] text-muted-foreground sm:text-base">
            Registration steps run Collect → File → Close, with firm-grade transparency and built-in approvals.
          </p>
        </FadeContent>

        <div
          className="mt-12 grid gap-0 sm:mt-14 md:grid-cols-3 md:gap-6"
          style={{ perspective: 1000 }}
        >
          {TILES.map((tile, i) => (
            <div key={tile.title} className="contents md:block">
              <FadeContent delay={0.08 * i} className="relative">
                <TiltCard>
                  <article className="h-full rounded-xl border border-border/60 bg-[oklch(var(--panel)/0.92)] p-6 shadow-[0_20px_50px_-28px_oklch(var(--orange-800)/0.25)] sm:p-7">
                    <Mono className="text-[10px] text-indigo-700/75">{tile.mono}</Mono>
                    <h3 className="mt-4 font-serif text-2xl font-medium tracking-tight text-foreground">
                      {tile.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tile.body}</p>
                    <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-indigo-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-all"
                        style={{ width: `${45 + i * 24}%` }}
                      />
                    </div>
                  </article>
                </TiltCard>
                {i < TILES.length - 1 ? <FlowArrow delay={i * 0.25} /> : null}
              </FadeContent>
              {i < TILES.length - 1 ? (
                <div className="md:hidden">
                  <FlowArrow delay={i * 0.25} vertical />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
