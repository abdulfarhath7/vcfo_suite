'use client';

import { Building2, RefreshCw } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { EmptyStateIllustrated } from '@/components/noir';
import { useClientOverview } from '@/lib/use-client-overview';
import { ClientOverviewHero } from '@/components/client/overview/ClientOverviewHero';
import { ClientNeeds } from '@/components/client/overview/ClientNeeds';
import { ClientPhaseBars } from '@/components/client/overview/ClientPhaseBars';
import { ClientWhoHolds } from '@/components/client/overview/ClientWhoHolds';
import { ClientAlerts } from '@/components/client/overview/ClientAlerts';
import { ClientComplianceRunway } from '@/components/client/overview/ClientComplianceRunway';
import { ClientDeliverables } from '@/components/client/overview/ClientDeliverables';
import { ClientEntityCard } from '@/components/client/overview/ClientEntityCard';
import { AskLauncher } from '@/components/ask/AskLauncher';
import { ClientActivityFeed } from '@/components/client/overview/ClientActivityFeed';
import { ClientMilestoneCelebration } from '@/components/client/overview/ClientMilestoneCelebration';
import { ClientOverviewSkeleton } from '@/components/client/overview/ClientOverviewSkeleton';
import { ClientTimeline } from '@/components/client/overview/ClientTimeline';
import { YourStepNotice } from '@/components/shell/YourStepNotice';

/**
 * CLIENT MISSION CONTROL.
 *
 * Answers three questions in order: what do you need from me, where are we,
 * what has happened / what is coming. Read-only — every actionable element
 * deep-links into the screen that owns the action, and the sequential gate is
 * reflected here, never bypassed.
 *
 * Pre/post-COI adaptivity: before the Certificate of Incorporation the page
 * leads with progress toward incorporation; after it, the entity ID card and
 * the compliance runway move up. Same modules, two moods.
 */
export default function ClientOverview() {
  const { data, isPending, isError, error, refetch, isFetching } = useClientOverview();

  if (isPending) {
    return (
      <PageTransition>
        <SEO
          title="Home — VCFO Suite"
          description="Your India entity at a glance: what we need from you, where we are, and what is coming."
          path="/app/client/overview"
        />
        <ClientOverviewSkeleton />
      </PageTransition>
    );
  }

  if (isError) {
    return (
      <PageTransition>
        <EmptyStateIllustrated
          icon={RefreshCw}
          title="We could not load your dashboard"
          description={error instanceof Error ? error.message : 'Please try again in a moment.'}
          actionLabel="Try again"
          onAction={() => void refetch()}
          className="mx-auto max-w-md"
        />
      </PageTransition>
    );
  }

  const overview = data?.overview;

  if (!overview) {
    return (
      <PageTransition>
        <EmptyStateIllustrated
          icon={Building2}
          title="No active engagement"
          description="Once your India entity project is set up, this is where you will see its progress."
          className="mx-auto max-w-md"
        />
      </PageTransition>
    );
  }

  const { engagement, progress, incorporated, identifiers, documents, compliance } = overview;

  const entityCard = (
    <ClientEntityCard engagement={engagement} identifiers={identifiers} />
  );

  const taxes = (
    <ClientComplianceRunway upcoming={compliance.upcoming} incorporated={incorporated} />
  );

  return (
    <PageTransition>
      <SEO
        title="Home — VCFO Suite"
        description="Your India entity at a glance: what we need from you, where we are, and what is coming."
        path="/app/client/overview"
      />

      <div className="flex flex-col gap-4">
        {overview.nextAction ? (
          <YourStepNotice
            stepKey={`client:${overview.nextAction.stepId}`}
            stepTitle={overview.nextAction.title}
            href={overview.nextAction.href}
          />
        ) : null}
        <ClientMilestoneCelebration engagementId={engagement.id} progress={progress} />

        <div className="rounded-xl border border-border bg-panel shadow-[0_18px_40px_-28px_oklch(var(--primary)/0.45)]">
          <ClientOverviewHero overview={overview} aside={<AskLauncher placement="inline" />} />
          <ClientNeeds needs={overview.needs} />
          <ClientPhaseBars
            progress={progress}
            milestones={overview.milestones}
            incorporated={incorporated}
          />
          <div className="grid grid-cols-1 border-t border-border md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 border-b border-border md:border-r xl:border-b-0">
              <ClientWhoHolds milestones={overview.milestones} />
            </div>
            <div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
              <ClientAlerts needs={overview.needs} upcoming={compliance.upcoming} />
            </div>
            <div className="min-w-0 md:col-span-2 xl:col-span-1">
              <ClientActivityFeed activity={overview.activity} />
            </div>
          </div>
        </div>

        {entityCard}
        {taxes}

        <ClientTimeline
          engagementId={engagement.id}
          startDate={engagement.startDate}
          milestones={overview.milestones}
          schedule={overview.schedule}
          team={overview.team}
        />

        <ClientDeliverables documents={documents} />

        {isFetching && (
          <p className="sr-only" role="status">
            Refreshing your dashboard
          </p>
        )}
      </div>
    </PageTransition>
  );
}
