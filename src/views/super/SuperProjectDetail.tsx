'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashHero } from '@/components/dash/DashHero';
import { AccentButton } from '@/components/noir/AccentButton';
import { SuperProjectJourney } from '@/components/super/project/SuperProjectJourney';
import { SuperProjectDocuments } from '@/components/super/project/SuperProjectDocuments';
import { SuperProjectRail } from '@/components/super/project/SuperProjectRail';
import { useSuperProject } from '@/lib/use-super-overview';
import { SUPER_PROJECTS_HREF } from '@/lib/super-overview';

/**
 * SUPER ADMIN PROJECT DETAIL (L2) — one engagement, end to end.
 *
 * Same composition as the lead dashboard: the headline numbers live INSIDE the
 * hero panel, then a main column + 318px rail of `DashSection` panels.
 * Read-only throughout; the only ways to act are the read-only inspection links
 * in the rail, which open the role shells that own those actions.
 */
export default function SuperProjectDetail() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');
  const query = useSuperProject(id);
  const detail = query.data?.detail ?? null;
  const missing = query.data?.missing ?? false;

  const seo = (
    <SEO
      title={`${detail?.summary.companyName ?? 'Project'} — VCFO Suite`}
      description="One engagement, end to end: journey, documents, compliance and activity."
      path={`${SUPER_PROJECTS_HREF}/${id}`}
    />
  );

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <DetailSkeleton />
      </PageTransition>
    );
  }

  if (missing) {
    return (
      <PageTransition>
        {seo}
        <div className="surface px-6 py-8 text-center">
          <p className="serif text-lg">That project is not here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been removed, or the link is out of date.
          </p>
          <Link
            href={SUPER_PROJECTS_HREF}
            className="mt-4 inline-flex rounded-full border border-border px-3.5 py-1.5 text-xs font-extrabold text-ink transition-colors hover:border-primary/40 hover:bg-primary-light/40 hover:text-primary"
          >
            Back to all projects
          </Link>
        </div>
      </PageTransition>
    );
  }

  if (query.isError || !detail) {
    return (
      <PageTransition>
        {seo}
        <div className="surface px-6 py-8 text-center">
          <p className="serif text-lg">This project could not load</p>
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

  const { summary } = detail;
  const overdueFilings = detail.filings.filter((filing) => filing.status === 'overdue').length;

  return (
    <PageTransition>
      {seo}

      <div className="flex flex-col gap-3">
        <DashHero
          subtitle={[
            summary.stageLabel,
            summary.stateLabel,
            summary.leadName ?? 'No lead assigned',
            idleKicker(summary.idleDays),
          ]
            .filter(Boolean)
            .join(' · ')}
          title={summary.companyName}
          ring={{ value: summary.progress.pct, caption: '% complete' }}
          stats={[
            { label: 'steps done', value: `${summary.progress.done}/${summary.progress.total}` },
            { label: 'with the firm', value: summary.ballInCourt.firm },
            {
              label: 'with the client',
              value: summary.ballInCourt.client,
              hot: summary.ballInCourt.client > 0,
            },
            { label: 'awaiting review', value: summary.approvalsPending },
            {
              label: 'filings',
              value: detail.filings.length,
              hot: overdueFilings > 0,
            },
          ]}
        />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            <SuperProjectJourney detail={detail} />
            <SuperProjectDocuments detail={detail} />
          </div>
          <SuperProjectRail detail={detail} />
        </div>
      </div>
    </PageTransition>
  );
}

/** Only worth saying once it means something — three days of silence. */
function idleKicker(idleDays: number | null): string | null {
  if (idleDays === null || idleDays < 3) return null;
  return `quiet ${idleDays}d`;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the project">
      <div className="lead-hero px-5 py-4 sm:px-6 sm:py-5">
        <div className="space-y-2.5">
          <div className="skeleton-brand h-3 w-40 rounded-full bg-white/20" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <div className="skeleton-brand h-8 w-[min(22rem,70%)] rounded-[var(--radius)] bg-white/20" aria-hidden />
            <div className="skeleton-brand h-14 w-14 shrink-0 rounded-full bg-white/20" aria-hidden />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="skeleton-brand h-[420px] rounded-[var(--radius)]" aria-hidden />
          <div className="skeleton-brand h-[240px] rounded-[var(--radius)]" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="skeleton-brand h-[180px] rounded-[var(--radius)]" aria-hidden />
          <div className="skeleton-brand h-[160px] rounded-[var(--radius)]" aria-hidden />
          <div className="skeleton-brand h-[220px] rounded-[var(--radius)]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
