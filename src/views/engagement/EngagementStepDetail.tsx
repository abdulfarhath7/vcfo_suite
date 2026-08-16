"use client";

import { useEffect, useMemo, useState } from 'react';
import { redirect, useParams, usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { StepDetailContent } from '@/components/admin/StepDetailContent';
import { RedirectTo } from '@/components/routing/RedirectTo';
import { checklist, getActiveCatalogItems } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import {
  adminProjectPath,
  adminProjectStepPath,
  internEngagementPath,
  internEngagementStepPath,
  isInternEngagementPathname,
} from '@/lib/project-step-path';
import {
  engagementRouteParamFromParams,
  resolveChecklistItemFromStepParam,
  resolveEngagementFromRouteParam,
} from '@/lib/slug';
import { StatusPillWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { ChecklistJourneyRail } from '@/components/incorporation/ChecklistJourneyRail';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { Surface } from '@/components/noir';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
} from '@/lib/checklist-step-gate';
import { cn } from '@/lib/utils';

/** Shared checklist step detail for admin projects and intern engagements. */
export default function EngagementStepDetail() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const {
    engagements,
    tasks,
    activity,
    updateTask,
    getStateForEngagement,
    refreshEngagementChecklist,
    engagementsLoading,
    user,
  } = useApp();
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);

  const isInternRoute = isInternEngagementPathname(pathname);
  const isIntern = user?.role === 'intern' || isInternRoute;
  const engagementParam = engagementRouteParamFromParams(params);
  const stepParam = params.stepId as string;
  const staffRole = user?.role === 'admin' || user?.role === 'manager' ? user.role : 'manager';

  const projectPath = isInternRoute
    ? internEngagementPath
    : (p: Parameters<typeof adminProjectPath>[0]) => adminProjectPath(p, staffRole);
  const stepPath = isInternRoute
    ? internEngagementStepPath
    : (
        p: Parameters<typeof adminProjectStepPath>[0],
        step: Parameters<typeof adminProjectStepPath>[1],
      ) => adminProjectStepPath(p, step, staffRole);
  const listRedirect = isInternRoute
    ? '/app/intern/clients'
    : staffRole === 'admin'
      ? '/app/admin/projects'
      : '/app/manager/projects';

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, engagementParam),
    [engagements, engagementParam],
  );
  const item = useMemo(
    () => resolveChecklistItemFromStepParam(stepParam),
    [stepParam],
  );
  const stepId = item?.id ?? stepParam;

  const eTasks = useMemo(
    () => tasks.filter((t) => t.engagementId === eng?.id),
    [tasks, eng?.id],
  );
  const task = eTasks.find((t) => t.checklistKey === stepId);
  const eActivity = useMemo(
    () => activity.filter((a) => a.engagementId === eng?.id).slice(0, 20),
    [activity, eng?.id],
  );

  const catalog = useMemo(() => getActiveCatalogItems(), []);
  const bucketSteps = useMemo(() => {
    if (!item) return [];
    const fromCatalog = catalog.filter((c) => c.bucket === item.bucket);
    if (fromCatalog.length > 0) return fromCatalog;
    return checklist.filter((c) => c.bucket === item.bucket).sort((a, b) => a.order - b.order);
  }, [item, catalog]);

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

  const responses = useMemo(() => {
    if (!item) return undefined;
    return extractItemResponses(item, checklistState[item.id]);
  }, [item, checklistState]);

  const { snapshot: brSnapshot } = useBoardResolutionProgress(eng?.id);
  const viewer = checklistGateViewerFrom('admin', user?.role);
  const gates = useMemo(
    () => gateActiveCatalog(checklistState, viewer),
    [checklistState, viewer],
  );
  const stepGate = item ? getStepGate(gates, item.id) : undefined;
  const displayStatus = useMemo(() => {
    if (!item) return undefined;
    return gateDisplayStatus(
      deriveChecklistDisplayStatus(item.id, item, checklistState[item.id], brSnapshot),
      stepGate,
    );
  }, [item, checklistState, brSnapshot, stepGate]);

  if (eng && !isInternRoute && eng.slug && engagementParam !== eng.slug) {
    redirect(stepPath(eng, stepParam));
  }

  if (eng && item?.slug && stepParam !== item.slug) {
    redirect(stepPath(eng, item));
  }

  if (!eng) return <RedirectTo href={listRedirect} />;
  if (!item) return <RedirectTo href={projectPath(eng)} />;

  const checklistLoading = engagementsLoading || checklistRefreshing;
  if (!checklistLoading && stepGate?.kind === 'locked') {
    const current = catalog.find((row) => {
      const kind = gates[row.id]?.kind;
      return kind === 'active' || kind === 'waiting';
    });
    redirect(current ? stepPath(eng, current) : projectPath(eng));
  }

  const projectHref = projectPath(eng);

  const handleCompleted = (completedId: string) => {
    const completed = eTasks.find((t) => t.id === completedId);
    if (!completed) return;
    const meta = catalog.find((c) => c.id === completed.checklistKey);
    if (!meta) return;
    const idx = catalog.findIndex((c) => c.id === meta.id);
    const taskByChecklistKey = new Map(eTasks.map((t) => [t.checklistKey, t]));
    for (let i = idx + 1; i < catalog.length; i++) {
      const next = taskByChecklistKey.get(catalog[i].id);
      if (next && next.status === 'not-started') {
        updateTask(next.id, { status: 'in-progress' });
        break;
      }
    }
  };

  const railItems = bucketSteps.map((step, index) => ({
    item: step,
    gate: getStepGate(gates, step.id),
    status: gateDisplayStatus(
      deriveChecklistDisplayStatus(step.id, step, checklistState[step.id], brSnapshot),
      getStepGate(gates, step.id),
    ),
    stepNumber: index + 1,
  }));

  return (
    <PageTransition>
      <SEO
        title={`${item.title} — ${eng.companyName}`}
        description={`Checklist step for ${eng.companyName}: forms, activity, and client responses.`}
        path={stepPath(eng, item)}
      />

      <button
        type="button"
        onClick={() => router.push(projectHref)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors min-h-[44px] sm:min-h-0"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        {eng.companyName}
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
          <Surface className="p-3">
            <ChecklistJourneyRail
              items={railItems}
              selectedId={item.id}
              onSelect={(id) => {
                const next = bucketSteps.find((s) => s.id === id);
                if (next) router.push(stepPath(eng, next));
              }}
            />
          </Surface>
        </aside>

        <div className="min-w-0 max-w-4xl">
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <ResponsibleRoleBadge role={item.responsibleRole} />
              {displayStatus && <StatusPillWithTimeline status={displayStatus} item={item} />}
            </div>
            <h1 className="serif text-2xl text-foreground tracking-tight">{item.title}</h1>
            {item.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-2 prose-narrow max-w-2xl">
                {item.description}
              </p>
            )}
            {item.notes && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 prose-narrow max-w-2xl">
                {item.notes}
              </p>
            )}
          </header>

          {checklistLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <HexgridLoader size="sm" />
              Syncing client answers…
            </div>
          )}

          {stepGate?.kind === 'locked' ? (
            <Surface className="p-6 text-sm text-muted-foreground">
              {stepGate.message}
            </Surface>
          ) : (
            <Surface
              className={cn(
                'p-6 md:p-8',
                stepGate?.kind === 'active' && 'ring-2 ring-brand/30 ring-offset-2 ring-offset-background',
              )}
            >
              <StepDetailContent
                item={item}
                task={task}
                engagementId={eng.id}
                responses={responses}
                activity={eActivity}
                onCompleted={task ? handleCompleted : undefined}
                theme="light"
                contentReady={!checklistLoading}
                onDone={() => router.push(projectHref)}
                hideDocumentsTab={isIntern}
              />
            </Surface>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
