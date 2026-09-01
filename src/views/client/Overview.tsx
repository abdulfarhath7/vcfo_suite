'use client';

import { Building2, RefreshCw } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { EmptyStateIllustrated } from '@/components/noir';
import { useClientOverview } from '@/lib/use-client-overview';
import { ClientOverviewHero } from '@/components/client/overview/ClientOverviewHero';
import { ClientNextAction } from '@/components/client/overview/ClientNextAction';
import { ClientPhaseBars } from '@/components/client/overview/ClientPhaseBars';
import { ClientBallInCourt } from '@/components/client/overview/ClientBallInCourt';
import { ClientComplianceRunway } from '@/components/client/overview/ClientComplianceRunway';
import { ClientDeliverables } from '@/components/client/overview/ClientDeliverables';
import { ClientEntityCard } from '@/components/client/overview/ClientEntityCard';
import { ClientTeamCard } from '@/components/client/overview/ClientTeamCard';
import { ClientActivityFeed } from '@/components/client/overview/ClientActivityFeed';
import { ClientMilestoneCelebration } from '@/components/client/overview/ClientMilestoneCelebration';
import { ClientOverviewSkeleton } from '@/components/client/overview/ClientOverviewSkeleton';

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

  // Pre/post-COI adaptivity: the entity ID card only exists once there is an
  // identity to show, and when it does it takes the top of the main column.
  const entityCard = incorporated ? (
    <ClientEntityCard engagement={engagement} identifiers={identifiers} />
  ) : null;

  const runway = (
    <ClientComplianceRunway upcoming={compliance.upcoming} incorporated={incorporated} />
  );

  return (
    <PageTransition>
      <SEO
        title="Home — VCFO Suite"
        description="Your India entity at a glance: what we need from you, where we are, and what is coming."
        path="/app/client/overview"
      />

      <div className="flex flex-col gap-3">
        <ClientMilestoneCelebration engagementId={engagement.id} progress={progress} />

        {/* 1 + 3 — where are we, and the four key numbers in the hero strip */}
        <ClientOverviewHero overview={overview} />

        {/* 2 — what do you need from me */}
        <ClientNextAction nextAction={overview.nextAction} />

        {/* Main column + right rail, same split as the lead dashboard's Today. */}
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Post-COI the entity identity earns the top of the column. */}
            {entityCard}

            {/* Progress is ONE card: bars, expanding to the milestone track.
                "Whose turn it is" only earns its place post-COI, where work
                genuinely ping-pongs; pre-COI it restates the hero and the
                next-action card. */}
            {incorporated ? (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <ClientPhaseBars
                  progress={progress}
                  milestones={overview.milestones}
                  incorporated={incorporated}
                />
                <ClientBallInCourt
                  waitingOnClient={overview.ballInCourt.waitingOnClient}
                  waitingOnFirm={overview.ballInCourt.waitingOnFirm}
                />
              </div>
            ) : (
              <ClientPhaseBars
                progress={progress}
                milestones={overview.milestones}
                incorporated={incorporated}
              />
            )}

            <ClientDeliverables documents={documents} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {runway}
            <ClientTeamCard team={overview.team} companyName={engagement.companyName} />
            <ClientActivityFeed activity={overview.activity} />
          </div>
        </div>

        {isFetching && (
          <p className="sr-only" role="status">
            Refreshing your dashboard
          </p>
        )}
      </div>
    </PageTransition>
  );
}
