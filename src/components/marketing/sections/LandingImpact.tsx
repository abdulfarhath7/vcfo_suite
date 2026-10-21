'use client';

import { useEffect, useRef, useState } from 'react';
import FadeContent from '@/components/marketing/react-bits/FadeContent';
import CountUp from '@/components/marketing/react-bits/CountUp';
import SpotlightCard from '@/components/marketing/react-bits/SpotlightCard';
import TiltCard from '@/components/marketing/react-bits/TiltCard';
import { Eyebrow } from '@/components/noir';
import { cn } from '@/lib/utils';

const STATS = [
  { to: 98, label: 'On-time filings', hint: 'Fewer lost deadlines' },
  { to: 3, label: 'Role-aware portals', hint: 'Manager · Lead · Client' },
  { to: 1, label: 'Single engagement thread', hint: 'One source of truth' },
] as const;

function ImpactStatCard({
  stat,
  index,
}: {
  stat: (typeof STATS)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setOpen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '40px' },
    );
    io.observe(el);
    const failsafe = window.setTimeout(() => setOpen(true), 700);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-state={open ? 'open' : 'closed'}
      className={cn('discrete-fade-up', `discrete-delay-${index + 1}`)}
    >
      <TiltCard className="h-full">
        <SpotlightCard className="group h-full min-h-[11.5rem] p-0 transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong hover:shadow-float sm:min-h-[12.5rem]">
          <div className="relative flex h-full flex-col p-6 sm:p-7">
            {/* KPI card: 3px brand stat-rule on the top edge (TOKENS.md, border widths). */}
            <div className="absolute inset-x-0 top-0 h-[3px] bg-brand" aria-hidden />
            <p className="font-serif text-[clamp(2.75rem,4.5vw,3.5rem)] font-medium leading-none tracking-tight text-ink">
              <CountUp to={stat.to} duration={1.5} />
            </p>
            <p className="mt-4 text-sm font-medium tracking-tight text-ink">{stat.label}</p>
            <p className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {stat.hint}
            </p>
          </div>
        </SpotlightCard>
      </TiltCard>
    </div>
  );
}

export function LandingImpact() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-surface py-14 sm:py-16 lg:py-18">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <FadeContent blur className="mb-8 max-w-xl sm:mb-10">
          <Eyebrow>On the record</Eyebrow>
          <div className="mt-4 h-px w-12 bg-brand" />
          <h2 className="mt-5 font-serif text-[clamp(1.85rem,3.5vw,2.75rem)] font-medium leading-tight tracking-tight text-ink">
            Turn compliance noise into confident progress.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-[1.8] text-ink-muted sm:text-base">
            VCFO Suite keeps every registration step, document upload, and client update connected in one polished engagement timeline.
          </p>
        </FadeContent>

        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5 lg:gap-6">
          {STATS.map((stat, i) => (
            <ImpactStatCard key={stat.label} stat={stat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
