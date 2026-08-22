'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { surfaceCssVars } from '@/lib/shell-appearance';
import {
  internFirstName,
  internGreeting,
  internGreetingHour,
  internWorkPath,
  type InternWorkKpis,
} from '@/lib/intern-work';
import { LeadHeroSettings } from '@/components/intern/LeadHeroSettings';

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total <= 0 ? 1 : Math.min(1, done / total);
  const c = 2 * Math.PI * 18;
  return (
    <div className="flex shrink-0 flex-col items-center" role="img" aria-label={`${done} of ${total} done today`}>
      <svg width="52" height="52" viewBox="0 0 44 44" className="shrink-0" aria-hidden>
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          transform="rotate(-90 22 22)"
        />
        <text
          x="22"
          y="26"
          textAnchor="middle"
          fill="white"
          fontSize="11"
          fontWeight="700"
          fontFamily="var(--font-serif)"
        >
          {done}
        </text>
      </svg>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/55">done today</p>
    </div>
  );
}

export function LeadHero({
  name,
  clockLabel,
  kpis,
}: {
  name: string;
  clockLabel: string;
  kpis: InternWorkKpis;
}) {
  const first = internFirstName(name);
  const greet = internGreeting(internGreetingHour(new Date()));
  const { hero, motion, reduceMotion } = useShellAppearance();
  const remaining = kpis.action.total;
  const totalToday = kpis.doneToday + remaining;
  const showAmbient = motion === 'ambient' && !reduceMotion && !hero.image;

  const stats = [
    { label: 'Action', value: kpis.action.total, href: internWorkPath({ focus: 'action' }) },
    { label: 'Overdue', value: kpis.overdue.total, href: internWorkPath({ focus: 'overdue' }), hot: kpis.overdue.total > 0 },
    { label: 'Waiting', value: kpis.waiting.total, href: internWorkPath({ focus: 'waiting' }) },
    { label: 'This week', value: kpis.dueWeek.total, href: internWorkPath({ focus: 'due' }) },
  ];

  return (
    <section
      className="lead-hero px-5 py-5 sm:px-6 sm:py-6"
      data-hero-image={hero.image ? 'true' : 'false'}
      style={surfaceCssVars(hero, 'hero')}
    >
      {showAmbient ? (
        <div className="lead-hero-fx" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className={i % 3 === 0 ? 'twinkle' : ''}
              style={{
                left: `${(i * 37 + 11) % 100}%`,
                width: 4 + (i % 3),
                height: 4 + (i % 3),
                borderRadius: '50%',
                background: `rgba(255,255,255,${0.22 + (i % 5) * 0.06})`,
                animationDuration: `${5 + (i % 5) * 0.8}s`,
                animationDelay: `${-((i * 0.41) % 6)}s`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative z-[2]">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] font-medium tracking-[0.04em] text-white/65">
            {clockLabel || 'Today'}
          </p>
          <LeadHeroSettings />
        </div>
        <div className="mt-1 flex items-start justify-between gap-4">
          <h1 className="serif min-w-0 flex-1 text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-white [text-shadow:0_1px_16px_rgb(15_23_42_/_0.35)] sm:text-[1.95rem]">
            Good {greet}, {first}
          </h1>
          <ProgressRing done={kpis.doneToday} total={totalToday} />
        </div>
      </div>

      <div className="relative z-[2] mt-5 h-px bg-white/12" />

      <div className="relative z-[2] mt-3.5 flex flex-wrap items-baseline text-white">
        {stats.map((stat, i) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={cn(
              'inline-flex items-baseline gap-1.5 py-0.5 pr-3.5 text-[12px] transition-opacity hover:opacity-80',
              i > 0 && 'border-l border-white/20 pl-3.5',
              stat.hot && 'text-white',
            )}
          >
            <span
              className={cn(
                'serif text-[1.05rem] font-semibold tabular-nums leading-none',
                stat.hot ? 'text-white' : 'text-white/95',
              )}
            >
              {stat.value}
            </span>
            <span className={cn('text-[11px] font-medium tracking-wide', stat.hot ? 'text-white/90' : 'text-white/58')}>
              {stat.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
