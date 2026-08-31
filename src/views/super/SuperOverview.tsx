'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashHero } from '@/components/dash/DashHero';
import { AccentButton } from '@/components/noir/AccentButton';
import {
  SuperPhasePanel,
  SuperStagePanel,
} from '@/components/super/overview/SuperPortfolioCharts';
import { SuperAttentionPanel } from '@/components/super/overview/SuperAttentionPanel';
import { SuperWorkloadPanel } from '@/components/super/overview/SuperWorkloadPanel';
import { SuperSideRail } from '@/components/super/overview/SuperSideRail';
import { SuperOverviewSkeleton } from '@/components/super/overview/SuperOverviewSkeleton';
import { useSuperOverview } from '@/lib/use-super-overview';
import { SUPER_ATTENTION_HREF, SUPER_PROJECTS_HREF } from '@/lib/super-overview';
import { internFirstName, internGreeting, internGreetingHour } from '@/lib/intern-work';

/**
 * SUPER ADMIN OVERVIEW (L0) — the observatory.
 *
 * Answers "is the firm healthy, and what needs me?" in five seconds, and every
 * element drills to the detail behind it. Read-only: this surface never writes
 * (context §3). All numbers come from one scoped read, `/api/super/overview`.
 *
 * Composition is the lead dashboard's, deliberately: `PageTransition` → hero
 * with the headline numbers INSIDE the hero panel (never as bare metric cards
 * floating beside it) → a `[minmax(0,1fr)_318px]` grid of main column and side
 * rail, both built from `DashSection` panels.
 */
export default function SuperOverview() {
  const { user } = useApp();
  const query = useSuperOverview();
  const overview = query.data;

  const greeting = useMemo(() => {
    const first = internFirstName(user?.name ?? '');
    const greet = internGreeting(internGreetingHour(new Date()));
    return first ? `Good ${greet}, ${first}` : 'Firm overview';
  }, [user?.name]);

  const seo = (
    <SEO
      title="Firm overview — VCFO Suite"
      description="Every engagement, every filing, every person — one live picture."
      path="/app/super/dashboard"
    />
  );

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <SuperOverviewSkeleton />
      </PageTransition>
    );
  }

  if (query.isError || !overview) {
    return (
      <PageTransition>
        {seo}
        <div className="surface px-6 py-8 text-center">
          <p className="serif text-lg">The firm overview could not load</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.error instanceof Error ? query.error.message : 'Something went wrong.'}
          </p>
          <AccentButton className="mt-4" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </AccentButton>
        </div>
      </PageTransition>
    );
  }

  const { kpis } = overview;
  const healthy = Math.max(0, kpis.engagements - kpis.needsAttention);

  return (
    <PageTransition>
      {seo}

      <div className="flex flex-col gap-3">
        <DashHero
          subtitle="Firm + client · every engagement"
          title={greeting}
          ring={{ value: healthy, total: kpis.engagements, caption: 'on track' }}
          stats={[
            { label: 'projects', value: kpis.engagements, href: SUPER_PROJECTS_HREF },
            {
              label: 'need attention',
              value: kpis.needsAttention,
              href: SUPER_ATTENTION_HREF,
              hot: kpis.needsAttention > 0,
            },
            { label: 'awaiting review', value: kpis.approvalsPending, href: '/app/admin/approvals' },
            {
              label: 'filings due',
              value: kpis.overdueFilings + kpis.filingsDueSoon,
              // TODO(owner): moves to /app/super/compliance in P2.
              href: '/app/admin/compliance',
              hot: kpis.overdueFilings > 0,
            },
          ]}
        />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              <SuperStagePanel overview={overview} />
              <SuperPhasePanel overview={overview} />
            </div>
            <SuperAttentionPanel overview={overview} />
            <SuperWorkloadPanel overview={overview} />
          </div>

          <SuperSideRail overview={overview} />
        </div>
      </div>
    </PageTransition>
  );
}
