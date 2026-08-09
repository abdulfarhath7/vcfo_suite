'use client';

import type { LucideIcon } from 'lucide-react';
import { ClipboardList, LayoutDashboard, UserRound } from 'lucide-react';
import FadeContent from '@/components/marketing/react-bits/FadeContent';
import SpotlightCard from '@/components/marketing/react-bits/SpotlightCard';
import GradientText from '@/components/marketing/react-bits/GradientText';
import { Eyebrow } from '@/components/noir';

const ROLES: {
  role: string;
  job: string;
  body: string;
  Icon: LucideIcon;
}[] = [
  {
    role: 'Manager',
    job: 'Portfolio oversight',
    body: 'Launch new engagements, monitor filings, and see progress without digging through spreadsheets.',
    Icon: LayoutDashboard,
  },
  {
    role: 'Project Lead',
    job: 'Execute the checklist',
    body: 'Complete filings step-by-step with clear handoffs and one source of truth for every task.',
    Icon: ClipboardList,
  },
  {
    role: 'Client',
    job: 'Stay in the loop',
    body: 'Provide documents, review milestones, and approve outcomes without chasing email.',
    Icon: UserRound,
  },
];

export function LandingRoles() {
  return (
    <section
      id="roles"
      className="relative scroll-mt-24 border-t border-border/40 bg-background py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <FadeContent blur className="max-w-2xl">
          <Eyebrow>Built for the firm</Eyebrow>
          <div className="mt-5 h-px w-12 bg-gradient-to-r from-indigo-500 to-transparent" />
          <h2 className="mt-7 font-serif text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.08] tracking-[-0.02em] text-foreground">
            Three portals. <GradientText className="font-serif">One seamless experience.</GradientText>
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.7] text-muted-foreground sm:text-base">
            Overview for managers. Focus for leads. Clarity for clients — all in a unified compliance cockpit.
          </p>
        </FadeContent>

        <div className="mt-12 grid gap-5 sm:mt-14 lg:grid-cols-3 lg:gap-6">
          {ROLES.map((item, i) => (
            <FadeContent key={item.role} delay={0.1 * i}>
              <SpotlightCard className="h-full min-h-[240px]">
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80"
                  aria-hidden
                >
                  <item.Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-700/70">
                  {item.job}
                </p>
                <h3 className="mt-3 font-serif text-[1.85rem] font-medium leading-none tracking-tight text-foreground sm:text-[2.1rem]">
                  {item.role}
                </h3>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </SpotlightCard>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
