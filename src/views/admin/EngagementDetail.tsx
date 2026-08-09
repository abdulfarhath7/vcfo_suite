"use client";

import { useEffect, useMemo, useState } from 'react';
import { redirect, useParams, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Eyebrow, ProgressRing, Surface } from '@/components/noir';
import { StatusPillWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
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
} from '@/lib/project-step-path';
import {
  engagementRouteParamFromParams,
  resolveEngagementFromRouteParam,
} from '@/lib/slug';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { BoardResolutionStepLink } from '@/components/incorporation/BoardResolutionStepLink';
import { ProgressEmailCcSection } from '@/components/incorporation/ProgressEmailCcSection';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';

const BUCKETS: Bucket[] = ['pre-inc', 'post-inc', 'fema', 'statutory'];

export default function EngagementDetail() {
  const params = useParams();
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

  const isIntern = user?.role === 'intern';
  const stepPath = isIntern ? internEngagementStepPath : adminProjectStepPath;
  const backHref = isIntern ? '/app/intern/clients' : undefined;

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

  const renderChecklistRow = (it: (typeof checklist)[number], displayOrder: number) => {
    const responses = extractItemResponses(it, checklistState[it.id]);
    const displayStatus = deriveChecklistDisplayStatus(
      it.id,
      it,
      checklistState[it.id],
      brSnapshot,
    );
    return (
      <button
        key={it.id}
        type="button"
        onClick={() => router.push(stepPath(eng, it))}
        className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-raised/40 min-h-11"
      >
        <div className="text-[11px] text-text-tertiary tabular-nums">{displayOrder}</div>
        <div className="min-w-0">
          <div className="text-[13px] text-ink truncate">{it.title}</div>
          <MilestoneResponseRowSummary item={it} responses={responses} variant="admin" />
          {isIntern && it.id === 'pre-2' && (
            <div
              className="mt-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <BoardResolutionStepLink engagement={eng} />
            </div>
          )}
        </div>
        <StatusPillWithTimeline status={displayStatus} item={it} />
        <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
      </button>
    );
  };

  return (
    <PageTransition>
      <SEO
        title={`${eng.companyName} — VCFO Suite`}
        description={`GCC setup project workspace for ${eng.companyName}.`}
        path={`/app/${user?.role}/engagements/${eng.id}`}
      />

      <button
        type="button"
        onClick={() => (backHref ? router.push(backHref) : router.back())}
        className="mb-4 flex min-h-11 items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to portfolio
      </button>

      <Surface raised className="mb-5 flex flex-wrap items-center gap-6 p-6">
        <ProgressRing value={pct} size={64} />
        <div className="min-w-0 flex-1">
          <Eyebrow>{eng.stage}</Eyebrow>
          <h1 className="serif mt-1 text-[32px] tracking-tight text-foreground">{eng.companyName}</h1>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            Delivery owner · {intern?.name ?? 'Unassigned'}
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
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary mb-4">
          <HexgridLoader size="sm" />
          Syncing client answers…
        </div>
      )}

      {isIntern && <ProgressEmailCcSection engagementId={eng.id} />}

      <div className="space-y-6">
        {BUCKETS.map((b) => {
          const items = checklist.filter((it) => it.bucket === b);
          return (
            <section key={b}>
              <Eyebrow className="mb-2">{BUCKET_LABEL[b]}</Eyebrow>
              {b === 'pre-inc' ? (
                <div className="space-y-4">
                  {preIncPhases.map((phase) => (
                    <div key={phase.id} className="surface overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-muted/25">
                        <div className="text-[12px] font-medium text-ink">{phase.title}</div>
                        {phase.subtitle && (
                          <div className="text-[11px] text-text-tertiary">{phase.subtitle}</div>
                        )}
                      </div>
                      {phase.items.map((it) => {
                        const phaseStep = getPreIncPhaseStep(it.id)?.stepNumber ?? it.order;
                        return renderChecklistRow(it, phaseStep);
                      })}
                    </div>
                  ))}
                </div>
              ) : b === 'post-inc' ? (
                <div className="space-y-4">
                  {postIncPhases.map((phase) => (
                    <div key={phase.id} className="surface overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-muted/25">
                        <div className="text-[12px] font-medium text-ink">{phase.title}</div>
                        {phase.subtitle && (
                          <div className="text-[11px] text-text-tertiary">{phase.subtitle}</div>
                        )}
                      </div>
                      {phase.items.map((it) => {
                        const phaseStep = getPostIncPhaseStep(it.id)?.stepNumber ?? it.order;
                        return renderChecklistRow(it, phaseStep);
                      })}
                    </div>
                  ))}
                </div>
              ) : b === 'statutory' ? (
                <div className="space-y-4">
                  {registrationPhases.map((phase) => (
                    <div key={phase.id} className="surface overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-muted/25">
                        <div className="text-[12px] font-medium text-ink">{phase.title}</div>
                        {phase.subtitle && (
                          <div className="text-[11px] text-text-tertiary">{phase.subtitle}</div>
                        )}
                      </div>
                      {phase.items.map((it) => {
                        const phaseStep = getRegistrationPhaseStep(it.id)?.stepNumber ?? it.order;
                        return renderChecklistRow(it, phaseStep);
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="surface overflow-hidden">
                  {items.map((it) => renderChecklistRow(it, it.order))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </PageTransition>
  );
}
