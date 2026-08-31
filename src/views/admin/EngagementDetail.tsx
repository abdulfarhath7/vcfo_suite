"use client";

import { useEffect, useMemo, useState } from 'react';
import { redirect, useParams, usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Eyebrow, ProgressRing, Surface } from '@/components/noir';
import { ChecklistStatusPill } from '@/components/incorporation/ChecklistStatusBadge';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import {
  checklist,
  BUCKET_LABEL,
  Bucket,
  getPreIncPhases,
  getPreIncPhaseStep,
  getPostIncPhases,
  getPostIncPhaseStep,
  getRegistrationPhases,
  getRegistrationPhaseStep,
} from '@/data/checklist';
import { MilestoneResponseRowSummary } from '@/views/incorporation/MilestoneResponseRowSummary';
import { extractItemResponses } from '@/lib/checklist-responses';
import {
  adminProjectStepPath,
  internEngagementPath,
  internEngagementStepPath,
  isInternEngagementPathname,
} from '@/lib/project-step-path';
import {
  engagementRouteParamFromParams,
  resolveEngagementFromRouteParam,
} from '@/lib/slug';
import { ChevronRight } from 'lucide-react';
import { BoardResolutionStepLink } from '@/components/incorporation/BoardResolutionStepLink';
import {
  InternEngagementOverview,
  InternOverviewSyncNotice,
} from '@/components/incorporation/InternEngagementOverview';
import {
  INTERN_PHASE_TABS_ENABLED,
  InternNowStrip,
  InternPhaseEntryCards,
  InternPhaseTabs,
  InternRegistrationGroupedRows,
  InternStepDoneMark,
} from '@/components/incorporation/InternOverviewProgress';
import {
  internOverviewCurrentItemInPhase,
  internOverviewNow,
  internOverviewPhases,
  internPhaseStepCounts,
} from '@/lib/intern-overview-progress';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
} from '@/lib/checklist-step-gate';
import { notifyChecklistStepLocked } from '@/components/incorporation/ChecklistJourneyRail';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { cn } from '@/lib/utils';

const ALL_BUCKETS: Bucket[] = ['pre-inc', 'post-inc', 'fema', 'statutory'];
const INTERN_BUCKETS: Bucket[] = ['pre-inc', 'post-inc', 'statutory'];
/** Sticky “You are here” strip on intern engagement overview. */
const INTERN_YOU_ARE_HERE_ENABLED = false;

function phasesForBucket(
  bucket: Bucket,
  preInc: ReturnType<typeof getPreIncPhases>,
  postInc: ReturnType<typeof getPostIncPhases>,
  registration: ReturnType<typeof getRegistrationPhases>,
) {
  if (bucket === 'pre-inc') return preInc;
  if (bucket === 'post-inc') return postInc;
  if (bucket === 'statutory') return registration;
  return null;
}

function phaseStepNumber(bucket: Bucket, itemId: string, fallback: number): number {
  if (bucket === 'pre-inc') return getPreIncPhaseStep(itemId)?.stepNumber ?? fallback;
  if (bucket === 'post-inc') return getPostIncPhaseStep(itemId)?.stepNumber ?? fallback;
  if (bucket === 'statutory') return getRegistrationPhaseStep(itemId)?.stepNumber ?? fallback;
  return fallback;
}

export default function EngagementDetail() {
  const params = useParams();
  const pathname = usePathname();
  const routeParam = engagementRouteParamFromParams(params);
  const {
    engagements,
    tasks,
    teamMembers,
    user,
    getStateForEngagement,
    refreshEngagementChecklist,
    engagementsLoading,
  } = useApp();
  const router = useRouter();
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);

  const isInternRoute = isInternEngagementPathname(pathname);
  const isIntern = user?.role === 'intern' || isInternRoute;
  const stepPath = isIntern ? internEngagementStepPath : adminProjectStepPath;

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, routeParam),
    [engagements, routeParam],
  );

  useEffect(() => {
    if (!eng?.id) return;
    let cancelled = false;
    setChecklistRefreshing(true);
    void refreshEngagementChecklist(eng.id).finally(() => {
      if (!cancelled) setChecklistRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eng?.id, refreshEngagementChecklist]);

  const checklistState = useMemo(
    () => (eng ? getStateForEngagement(eng) : {}),
    [getStateForEngagement, eng],
  );
  const { snapshot: brSnapshot } = useBoardResolutionProgress(eng?.id);

  const checklistLoading = engagementsLoading || checklistRefreshing;
  const preIncPhases = useMemo(() => getPreIncPhases(), []);
  const postIncPhases = useMemo(() => getPostIncPhases(), []);
  const registrationPhases = useMemo(() => getRegistrationPhases(), []);

  const internPhases = useMemo(() => internOverviewPhases(), []);

  const gateViewer = isIntern
    ? 'intern'
    : checklistGateViewerFrom('admin', user?.role);
  const gates = useMemo(
    () => gateActiveCatalog(checklistState, gateViewer),
    [checklistState, gateViewer],
  );

  const internNow = useMemo(
    () => (isIntern ? internOverviewNow(gates) : null),
    [isIntern, gates],
  );

  if (isIntern && eng) {
    const canonical = internEngagementPath(eng);
    const suffix = canonical.split('/').pop();
    if (suffix && suffix !== routeParam) {
      redirect(canonical);
    }
  }

  if (!eng && engagementsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HexgridLoader />
      </div>
    );
  }

  if (!eng) {
    return (
      <div className="p-6 text-[13px] text-text-secondary">
        This project isn’t in your portfolio — it may have been removed or you don’t have access.
      </div>
    );
  }

  const eTasks = tasks.filter((t) => t.engagementId === eng.id);
  const done = eTasks.filter((t) => t.status === 'completed').length;
  const pct = eTasks.length ? (done / eTasks.length) * 100 : 0;
  const intern = teamMembers.find((t) => t.id === eng.internId);
  const visibleBuckets = isIntern ? INTERN_BUCKETS : ALL_BUCKETS;

  const renderChecklistRow = (it: (typeof checklist)[number], displayOrder: number) => {
    const responses = extractItemResponses(it, checklistState[it.id]);
    const gate = getStepGate(gates, it.id);
    const openStep = () => {
      if (!isIntern && !gate.canOpen) {
        notifyChecklistStepLocked(gate.message);
        return;
      }
      router.push(stepPath(eng, it));
    };

    if (isIntern) {
      const waiting = gate.kind === 'waiting';
      const internOwned = gate.kind === 'active';
      return (
        <button
          key={it.id}
          type="button"
          onClick={openStep}
          className={cn(
            'grid min-h-11 w-full grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-0',
            waiting && 'bg-warning-light/80 hover:bg-warning-light',
            internOwned && 'bg-primary-light/80 hover:bg-primary-light',
            !waiting && !internOwned && 'hover:bg-raised/40',
            'group',
          )}
        >
          <InternStepDoneMark done={gate.kind === 'done'} />
          <div className="min-w-0">
            <div className={cn('text-[13px]', internOwned ? 'font-medium text-primary' : 'text-ink')}>
              {it.title}
            </div>
            {waiting && gate.message ? (
              <div className="mt-0.5 text-[11px] text-warning-text">{gate.message}</div>
            ) : null}
            <MilestoneResponseRowSummary item={it} responses={responses} variant="admin" hideStatus />
            {it.id === 'pre-2' ? (
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- propagation guard, not an interaction: keeps clicks on the nested link from firing the row button. A role here would add a stray tab stop.
              <div
                className="mt-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <BoardResolutionStepLink engagement={eng} />
              </div>
            ) : null}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </button>
      );
    }

    const displayStatus = gateDisplayStatus(
      deriveChecklistDisplayStatus(it.id, it, checklistState[it.id], brSnapshot),
      gate,
    );

    return (
      <button
        key={it.id}
        type="button"
        onClick={openStep}
        className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-raised/40 min-h-11"
      >
        <div className="text-[11px] text-text-tertiary tabular-nums">{displayOrder}</div>
        <div className="min-w-0">
          <div className={gate.canOpen ? 'text-[13px] text-ink truncate' : 'text-[13px] text-muted-foreground truncate'}>
            {it.title}
          </div>
          {gate.kind === 'waiting' && gate.message && (
            <div className="mt-0.5 text-[11px] text-warning-text">{gate.message}</div>
          )}
          <MilestoneResponseRowSummary item={it} responses={responses} variant="admin" />
        </div>
        {/* Upcoming steps show their real status, not a padlock — the gate is
            unchanged, it just is not drawn as a lock-out. */}
        <ChecklistStatusPill status={displayStatus} />
        {gate.canOpen ? (
          <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden />
        )}
      </button>
    );
  };

  const internPhaseHref = (phaseId: string): string | null => {
    const phase = internPhases.find((group) => group.id === phaseId);
    if (!phase) return null;
    const item = internOverviewCurrentItemInPhase(phase.items, gates);
    if (!item) return internEngagementPath(eng);
    return internEngagementStepPath(eng, item);
  };

  const internPhaseTabs = internPhases.map((phase) => {
    const { done, total } = internPhaseStepCounts(phase.items, gates);
    return { id: phase.id, title: phase.title, done, total };
  });

  const renderInternPhases = () => (
    <InternPhaseTabs
      engagementId={eng.id}
      currentPhaseId={internNow?.phaseId ?? null}
      phases={internPhaseTabs}
    >
      {(phaseId) => {
        const phase = internPhases.find((group) => group.id === phaseId);
        if (!phase) return null;
        if (phase.id === 'registration-phase-4') {
          return (
            <InternRegistrationGroupedRows
              items={phase.items}
              renderRow={(it) =>
                renderChecklistRow(it, phaseStepNumber(it.bucket, it.id, it.order))
              }
            />
          );
        }
        return phase.items.map((it) =>
          renderChecklistRow(it, phaseStepNumber(it.bucket, it.id, it.order)),
        );
      }}
    </InternPhaseTabs>
  );

  return (
    <PageTransition>
      <SEO
        title={`${eng.companyName} — VCFO Suite`}
        description={`GCC setup project workspace for ${eng.companyName}.`}
        path={`/app/${user?.role}/engagements/${eng.id}`}
      />

      {isIntern ? (
        <InternEngagementOverview companyName={eng.companyName} engagementId={eng.id}>
          {INTERN_YOU_ARE_HERE_ENABLED && internNow ? (
            <InternNowStrip
              now={internNow}
              onOpen={() => router.push(internEngagementStepPath(eng, internNow.item))}
            />
          ) : null}

          {checklistLoading ? (
            <InternOverviewSyncNotice>
              <HexgridLoader size="sm" />
              Syncing client answers…
            </InternOverviewSyncNotice>
          ) : null}

          {INTERN_PHASE_TABS_ENABLED ? (
            renderInternPhases()
          ) : (
            <InternPhaseEntryCards
              phases={internPhases}
              gates={gates}
              hrefForPhase={internPhaseHref}
            />
          )}
        </InternEngagementOverview>
      ) : (
        <>
          <Surface raised className="mb-5 flex flex-wrap items-center gap-6 p-6">
            <ProgressRing value={pct} size={64} />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary-light px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {eng.stage}
              </span>
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                <PageBackButton className="-ml-1.5" />
                <h1 className="serif min-w-0 text-[32px] tracking-tight text-foreground">{eng.companyName}</h1>
              </div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                Delivery owner · {intern?.name ?? 'Unassigned'}
                {eTasks.length - done > 0
                  ? ` · Waiting on work · ${eTasks.length - done} remaining`
                  : ' · All tasks clear'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 text-right">
              <div>
                <div className="serif text-[26px] text-foreground">{done}</div>
                <div className="text-[11px] text-muted-foreground">Complete</div>
              </div>
              <div>
                <div className="serif text-[26px] text-foreground">{eTasks.length - done}</div>
                <div className="text-[11px] text-muted-foreground">Remaining</div>
              </div>
            </div>
          </Surface>

          {checklistLoading && (
            <div className="mb-4 flex items-center gap-2 text-[12px] text-text-tertiary">
              <HexgridLoader size="sm" />
              Syncing client answers…
            </div>
          )}

          <div className="space-y-6">
            {visibleBuckets.map((b) => {
              const items = checklist.filter((it) => it.bucket === b);
              const phases = phasesForBucket(b, preIncPhases, postIncPhases, registrationPhases);
              const body = phases ? (
                <div className="space-y-4">
                  {phases.map((phase) => {
                    const rows = phase.items.map((it) =>
                      renderChecklistRow(it, phaseStepNumber(b, it.id, it.order)),
                    );
                    return (
                      <div key={phase.id} className="surface overflow-hidden">
                        <div className="border-b border-border bg-muted/25 px-4 py-2">
                          <div className="text-[12px] font-medium text-ink">{phase.title}</div>
                          {phase.subtitle && (
                            <div className="text-[11px] text-text-tertiary">{phase.subtitle}</div>
                          )}
                        </div>
                        {rows}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="surface overflow-hidden">
                  {items.map((it) => renderChecklistRow(it, it.order))}
                </div>
              );

              return (
                <section key={b}>
                  <Eyebrow className="mb-2">{BUCKET_LABEL[b]}</Eyebrow>
                  {body}
                </section>
              );
            })}
          </div>
        </>
      )}
    </PageTransition>
  );
}
