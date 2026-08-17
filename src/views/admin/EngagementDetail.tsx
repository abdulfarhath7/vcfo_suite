"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { redirect, useParams, usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Eyebrow, ProgressRing, Surface } from '@/components/noir';
import { StatusPillWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { StatusPill } from '@/components/common/StatusPill';
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
  getActiveCatalogItems,
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
import { ArrowLeft, ChevronRight, Lock } from 'lucide-react';
import { BoardResolutionStepLink } from '@/components/incorporation/BoardResolutionStepLink';
import { ProgressEmailCcSection } from '@/components/incorporation/ProgressEmailCcSection';
import {
  InternProgressRail,
  internNodeKind,
} from '@/components/incorporation/InternProgressRail';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
} from '@/lib/checklist-step-gate';
import { notifyChecklistStepLocked } from '@/components/incorporation/ChecklistJourneyRail';
import { cn } from '@/lib/utils';

const ALL_BUCKETS: Bucket[] = ['pre-inc', 'post-inc', 'fema', 'statutory'];
const INTERN_BUCKETS: Bucket[] = ['pre-inc', 'post-inc', 'statutory'];

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

function InternBucketSection({
  bucket,
  label,
  children,
}: {
  bucket: Bucket;
  label: string;
  children: ReactNode;
}) {
  return (
    <section id={`intern-bucket-${bucket}`} className="scroll-mt-24">
      <Eyebrow className="mb-2">{label}</Eyebrow>
      {children}
    </section>
  );
}

function InternPhaseCard({
  phase,
  open,
  onOpenChange,
  children,
}: {
  phase: { id: string; title: string; subtitle?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div id={`intern-phase-${phase.id}`} className="surface scroll-mt-24 overflow-hidden">
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-center justify-start bg-muted/25 px-4 py-2 text-left [&>svg]:hidden after:hidden',
            open && 'border-b border-border',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-ink">{phase.title}</div>
            {phase.subtitle ? (
              <div className="text-[11px] text-text-tertiary">{phase.subtitle}</div>
            ) : null}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function internFutureStatus(bucket: Bucket): string {
  if (bucket === 'post-inc') return 'Locked until pre-incorporation is complete';
  if (bucket === 'statutory') return 'Locked until post-incorporation is complete';
  return 'Opens after the previous stage is complete';
}

function InternFutureBucketCard({
  bucket,
  label,
  stepCount,
  open,
  onOpenChange,
  children,
}: {
  bucket: Bucket;
  label: string;
  stepCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div id={`intern-bucket-${bucket}`} className="scroll-mt-24">
        <Surface className="overflow-hidden p-0">
          <CollapsibleTrigger className="flex w-full flex-col items-start border-b border-transparent px-5 py-4 text-left transition-colors hover:bg-raised/30 data-[state=open]:border-border">
            <div className="text-[15px] font-medium tracking-tight text-foreground">{label}</div>
            {!open ? (
              <>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  {internFutureStatus(bucket)}
                </p>
                <p className="mt-1.5 text-[11px] text-text-tertiary">{stepCount} steps</p>
              </>
            ) : null}
          </CollapsibleTrigger>
          <CollapsibleContent>{children}</CollapsibleContent>
        </Surface>
      </div>
    </Collapsible>
  );
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

  const internGroups = useMemo(
    () => [
      { bucket: 'pre-inc' as const, label: BUCKET_LABEL['pre-inc'], phases: preIncPhases },
      { bucket: 'post-inc' as const, label: BUCKET_LABEL['post-inc'], phases: postIncPhases },
      { bucket: 'statutory' as const, label: BUCKET_LABEL['statutory'], phases: registrationPhases },
    ],
    [preIncPhases, postIncPhases, registrationPhases],
  );

  const gates = useMemo(
    () => gateActiveCatalog(checklistState, checklistGateViewerFrom('admin', user?.role)),
    [checklistState, user?.role],
  );

  const workingSection = useMemo(() => {
    const current = getActiveCatalogItems().find((item) => {
      const kind = getStepGate(gates, item.id).kind;
      return kind === 'active' || kind === 'waiting';
    });
    if (!current) {
      return { bucket: null as Bucket | null, phaseId: null as string | null };
    }
    const phaseId =
      getPreIncPhaseStep(current.id)?.phaseId ??
      getPostIncPhaseStep(current.id)?.phaseId ??
      getRegistrationPhaseStep(current.id)?.phaseId ??
      null;
    return { bucket: current.bucket, phaseId };
  }, [gates]);

  const [openBuckets, setOpenBuckets] = useState<Bucket[]>(() =>
    workingSection.bucket ? [workingSection.bucket] : [],
  );
  const [railOpenBuckets, setRailOpenBuckets] = useState<Bucket[]>(() =>
    workingSection.bucket ? [workingSection.bucket] : [],
  );
  const [openPhases, setOpenPhases] = useState<string[]>(() =>
    workingSection.phaseId ? [workingSection.phaseId] : [],
  );
  const appliedWorkingKey = useRef(
    `${workingSection.bucket ?? ''}:${workingSection.phaseId ?? ''}`,
  );

  useEffect(() => {
    if (!isIntern) return;
    const nextKey = `${workingSection.bucket ?? ''}:${workingSection.phaseId ?? ''}`;
    if (appliedWorkingKey.current === nextKey) return;
    appliedWorkingKey.current = nextKey;
    setOpenBuckets(workingSection.bucket ? [workingSection.bucket] : []);
    setRailOpenBuckets(workingSection.bucket ? [workingSection.bucket] : []);
    setOpenPhases(workingSection.phaseId ? [workingSection.phaseId] : []);
  }, [isIntern, workingSection.bucket, workingSection.phaseId]);

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
  const internActiveGroups = internGroups.filter(
    (group) => internNodeKind(group.phases.flatMap((p) => p.items), gates) !== 'locked',
  );
  const internFutureGroups = internGroups.filter(
    (group) => internNodeKind(group.phases.flatMap((p) => p.items), gates) === 'locked',
  );

  const toggleRailBucket = (bucket: Bucket) => {
    setRailOpenBuckets((prev) =>
      prev.includes(bucket) ? prev.filter((b) => b !== bucket) : [...prev, bucket],
    );
  };

  const setPhaseOpen = (phaseId: string, open: boolean) => {
    setOpenPhases((prev) => {
      if (open) return prev.includes(phaseId) ? prev : [...prev, phaseId];
      return prev.filter((id) => id !== phaseId);
    });
  };

  const focusInternPhase = (bucket: Bucket, phaseId: string) => {
    setRailOpenBuckets((prev) => (prev.includes(bucket) ? prev : [...prev, bucket]));
    setOpenBuckets((prev) => (prev.includes(bucket) ? prev : [...prev, bucket]));
    setOpenPhases((prev) => (prev.includes(phaseId) ? prev : [...prev, phaseId]));
    window.setTimeout(() => {
      document.getElementById(`intern-phase-${phaseId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  const renderChecklistRow = (it: (typeof checklist)[number], displayOrder: number) => {
    const responses = extractItemResponses(it, checklistState[it.id]);
    const gate = getStepGate(gates, it.id);
    const displayStatus = gateDisplayStatus(
      deriveChecklistDisplayStatus(it.id, it, checklistState[it.id], brSnapshot),
      gate,
    );
    const openStep = () => {
      if (!gate.canOpen) {
        notifyChecklistStepLocked(gate.message);
        return;
      }
      router.push(stepPath(eng, it));
    };

    if (isIntern) {
      const locked = gate.kind === 'locked';
      const body = (
        <>
          <div className="text-[11px] text-text-tertiary tabular-nums">{displayOrder}</div>
          <div className="min-w-0">
            <div
              className={cn(
                'truncate text-[13px]',
                locked ? 'text-muted-foreground' : 'text-ink',
              )}
            >
              {it.title}
            </div>
            {gate.kind === 'waiting' && gate.message ? (
              <div className="mt-0.5 text-[11px] text-warning-text">{gate.message}</div>
            ) : null}
            {locked && gate.message ? (
              <div className="mt-0.5 text-[11px] text-muted-foreground">{gate.message}</div>
            ) : null}
            <MilestoneResponseRowSummary item={it} responses={responses} variant="admin" />
            {it.id === 'pre-2' && gate.canOpen ? (
              <div
                className="mt-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <BoardResolutionStepLink engagement={eng} />
              </div>
            ) : null}
          </div>
          {!locked ? <StatusPill status={displayStatus} /> : null}
          {!locked ? <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" /> : null}
        </>
      );
      if (locked) {
        return (
          <div
            key={it.id}
            className="grid w-full grid-cols-[28px_1fr] items-center gap-3 border-b border-border px-4 py-3.5 last:border-0"
          >
            {body}
          </div>
        );
      }
      return (
        <button
          key={it.id}
          type="button"
          onClick={openStep}
          className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-raised/40 min-h-11"
        >
          {body}
        </button>
      );
    }

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
        {gate.kind === 'locked' ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <StatusPillWithTimeline status={displayStatus} item={it} />
        )}
        {gate.canOpen ? (
          <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-text-tertiary" aria-hidden />
        )}
      </button>
    );
  };

  const renderInternPhases = (bucket: Bucket, phases: NonNullable<ReturnType<typeof phasesForBucket>>) => (
    <div className="space-y-4">
      {phases.map((phase) => (
        <InternPhaseCard
          key={phase.id}
          phase={phase}
          open={openPhases.includes(phase.id)}
          onOpenChange={(open) => setPhaseOpen(phase.id, open)}
        >
          {phase.items.map((it) => renderChecklistRow(it, phaseStepNumber(bucket, it.id, it.order)))}
        </InternPhaseCard>
      ))}
    </div>
  );

  return (
    <PageTransition>
      <SEO
        title={`${eng.companyName} — VCFO Suite`}
        description={`GCC setup project workspace for ${eng.companyName}.`}
        path={`/app/${user?.role}/engagements/${eng.id}`}
      />

      {!isIntern && (
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex min-h-11 items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to portfolio
        </button>
      )}

      <div
        className={cn(
          isIntern && 'relative w-full min-h-[calc(100vh-var(--shell-sticky-top)-2.5rem)] lg:pr-[15rem] xl:pr-[15.75rem]',
        )}
      >
        {isIntern && (
          <div className="mb-5 lg:hidden">
            <InternProgressRail
              groups={internGroups}
              gates={gates}
              openBuckets={railOpenBuckets}
              currentPhaseId={workingSection.phaseId}
              onToggleBucket={toggleRailBucket}
              onSelectPhase={focusInternPhase}
              variant="compact"
            />
          </div>
        )}

      <Surface
        raised
        className={cn(
          'mb-5',
          isIntern
            ? 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3'
            : 'flex flex-wrap items-center gap-6 p-6',
        )}
      >
        {isIntern ? (
          <>
            <h1 className="min-w-0 flex-1 serif text-[24px] leading-none tracking-tight text-foreground">
              {eng.companyName}
            </h1>
            <ProgressEmailCcSection
              engagementId={eng.id}
              variant="inline"
              className="w-full shrink-0 sm:w-auto sm:max-w-[min(28rem,52%)]"
            />
          </>
        ) : (
          <>
            <ProgressRing value={pct} size={64} />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary-light px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {eng.stage}
              </span>
              <h1 className="serif mt-1.5 text-[32px] tracking-tight text-foreground">{eng.companyName}</h1>
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
          </>
        )}
      </Surface>

      {checklistLoading && (
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary mb-4">
          <HexgridLoader size="sm" />
          Syncing client answers…
        </div>
      )}

      {isIntern ? (
        <>
          <div className="space-y-6">
            {internActiveGroups.map((group) => (
              <InternBucketSection
                key={group.bucket}
                bucket={group.bucket}
                label={group.label}
              >
                {renderInternPhases(group.bucket, group.phases)}
              </InternBucketSection>
            ))}
          </div>
          {internFutureGroups.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {internFutureGroups.map((group) => {
                const stepCount = group.phases.reduce((n, phase) => n + phase.items.length, 0);
                const open = openBuckets.includes(group.bucket);
                return (
                  <InternFutureBucketCard
                    key={group.bucket}
                    bucket={group.bucket}
                    label={group.label}
                    stepCount={stepCount}
                    open={open}
                    onOpenChange={(next) => {
                      setOpenBuckets((prev) => {
                        if (next) return prev.includes(group.bucket) ? prev : [...prev, group.bucket];
                        return prev.filter((id) => id !== group.bucket);
                      });
                      if (next) {
                        const first = group.phases[0];
                        if (first) setPhaseOpen(first.id, true);
                      }
                    }}
                  >
                    {group.phases.flatMap((phase) =>
                      phase.items.map((it) =>
                        renderChecklistRow(it, phaseStepNumber(group.bucket, it.id, it.order)),
                      ),
                    )}
                  </InternFutureBucketCard>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
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
                    <div className="px-4 py-2 border-b border-border bg-muted/25">
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
      )}

        {isIntern && (
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 hidden w-[14rem] lg:block xl:w-[14.75rem]">
            <div className="pointer-events-auto sticky top-[var(--shell-sticky-top)] h-[calc(100vh-var(--shell-sticky-top)-0.75rem)]">
              <InternProgressRail
                groups={internGroups}
                gates={gates}
                openBuckets={railOpenBuckets}
                currentPhaseId={workingSection.phaseId}
                onToggleBucket={toggleRailBucket}
                onSelectPhase={focusInternPhase}
                variant="rail"
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
