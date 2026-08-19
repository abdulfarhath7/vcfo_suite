'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { InternStepDoneMark } from '@/components/incorporation/InternStepDoneMark';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChecklistItem } from '@/data/checklist';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import {
  internEngagementPhaseTabDefault,
  internNodeKind,
  internOverviewPhaseTitle,
  internPhaseProgressFraction,
  internPhaseProgressLabel,
  internPhaseProgressPercent,
  internPhaseStepCounts,
  internRegistrationHeadingGroups,
  readInternEngagementPhaseTab,
  writeInternEngagementPhaseTab,
  type InternOverviewNow,
  type InternOverviewPhase,
} from '@/lib/intern-overview-progress';
import { cn } from '@/lib/utils';
import { fadeSwap, fadeSwapReduced, fadeUp, fadeUpReduced } from '@/lib/motion';
import { MotionActivePill } from '@/components/shell/MotionActivePill';
import { InternPhaseTickTrack } from '@/components/incorporation/InternPhaseTickTrack';
import styles from './intern-engagement-overview.module.css';

export { InternStepDoneMark } from '@/components/incorporation/InternStepDoneMark';

export function InternNowStrip({
  now,
  onOpen,
}: {
  now: InternOverviewNow;
  onOpen: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? fadeUpReduced : fadeUp;

  return (
    <m.div
      role="status"
      aria-label="Current step"
      variants={enter}
      initial="hidden"
      animate="show"
      className={cn(
        'relative sticky top-[var(--shell-sticky-top)] z-10 mb-5 overflow-hidden',
        'rounded-xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-0.5',
          now.waiting ? 'bg-warning' : 'bg-primary',
        )}
      />
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-[13px] leading-snug text-foreground">
          <span className="font-medium text-muted-foreground">You are here</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-medium">{now.phaseTitle}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="tabular-nums">
            {now.stepNumber} of {now.stepTotal}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span>{now.stepTitle}</span>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'text-[12px] font-medium',
              now.waiting ? 'text-warning-text' : 'text-primary',
            )}
          >
            {now.waiting ? 'Waiting on the client' : 'Your step'}
          </span>
          <Button type="button" size="sm" className="h-8 px-3 text-[12px]" onClick={onOpen}>
            Open step
          </Button>
        </div>
      </div>
    </m.div>
  );
}

/**
 * Intern overview phase tabs + in-card checklist. Off: four entry cards
 * replace this UI. Flip to true to restore tabs; persist is unchanged.
 */
export const INTERN_PHASE_TABS_ENABLED = false;

function internPhaseCardSubtitle(phaseId: string): string | null {
  if (phaseId === 'pre-inc-phase-1' || phaseId === 'pre-inc-phase-2') {
    return 'Pre-incorporation';
  }
  return null;
}

/** Four intern overview entry points — no nested checklist. */
export function InternPhaseEntryCards({
  phases,
  gates,
  hrefForPhase,
}: {
  phases: readonly InternOverviewPhase[];
  gates: Record<string, ChecklistStepGate>;
  hrefForPhase: (phaseId: string) => string | null;
}) {
  if (phases.length === 0) return null;

  return (
    <nav aria-label="Incorporation phases" className={cn('surface', styles.list)}>
      {phases.map((phase) => {
        const href = hrefForPhase(phase.id);
        if (!href) return null;
        const title = internOverviewPhaseTitle(phase.id, phase.title);
        const kind = internNodeKind(phase.items, gates);
        const done = kind === 'done';
        const current = kind === 'current';
        const subtitle = internPhaseCardSubtitle(phase.id);
        const { done: doneCount, total } = internPhaseStepCounts(phase.items, gates);
        const allDone = total > 0 && doneCount === total;
        return (
          <Link
            key={phase.id}
            href={href}
            aria-label={`${title}, ${internPhaseProgressLabel(doneCount, total)}`}
            aria-current={current ? 'step' : undefined}
            className={cn(styles.row, current && styles.rowCurrent)}
          >
            <span className={styles.rowLead}>
              <span className={styles.rowMark}>
                <InternStepDoneMark done={done} decorative className="h-5 w-5" />
              </span>
              <span className={styles.rowCopy}>
                <span className={styles.phaseTitle}>{title}</span>
                {subtitle ? <span className={styles.phaseSubtitle}>{subtitle}</span> : null}
              </span>
            </span>
            <span className={styles.rowProgress}>
              <InternPhaseTickTrack
                items={phase.items}
                gates={gates}
                className={styles.rowTrack}
              />
              <span
                className={cn(styles.rowCount, allDone && styles.rowCountDone)}
                aria-hidden
              >
                {internPhaseProgressFraction(doneCount, total)}
              </span>
            </span>
            <span className={styles.rowChevron}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const internPhaseTabTrigger = cn(
  'relative shrink-0 rounded-none bg-transparent px-3 py-2.5 text-[12px] font-medium',
  'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
  'text-text-tertiary transition-colors data-[state=active]:text-brand hover:text-ink',
);

export type InternPhaseTab = {
  id: string;
  title: string;
  done: number;
  total: number;
};

/** One intern overview tab row + selected phase panel. Last tab is per engagement. */
export function InternPhaseTabs({
  engagementId,
  currentPhaseId,
  phases,
  children,
}: {
  engagementId: string;
  currentPhaseId: string | null;
  phases: readonly InternPhaseTab[];
  children: (phaseId: string) => ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const phaseIds = phases.map((phase) => phase.id);
  const currentPhaseIdRef = useRef(currentPhaseId);
  const phaseIdsRef = useRef(phaseIds);
  currentPhaseIdRef.current = currentPhaseId;
  phaseIdsRef.current = phaseIds;

  const [tab, setTab] = useState(() =>
    internEngagementPhaseTabDefault(null, currentPhaseId, phaseIds),
  );

  useLayoutEffect(() => {
    setTab(
      internEngagementPhaseTabDefault(
        readInternEngagementPhaseTab(engagementId),
        currentPhaseIdRef.current,
        phaseIdsRef.current,
      ),
    );
  }, [engagementId]);

  if (phases.length === 0) return null;

  const value = phaseIds.includes(tab)
    ? tab
    : internEngagementPhaseTabDefault(null, currentPhaseId, phaseIds);
  const selected = phases.find((phase) => phase.id === value) ?? phases[0]!;
  const pct = internPhaseProgressPercent(selected.done, selected.total);
  const panelMotion = reduceMotion ? fadeSwapReduced : fadeSwap;

  const onValueChange = (next: string) => {
    setTab(next);
    writeInternEngagementPhaseTab(engagementId, next);
  };

  return (
    <Tabs value={value} onValueChange={onValueChange} className="surface overflow-hidden">
      <LayoutGroup id={`intern-phase-tabs-${engagementId}`}>
      <TabsList
        aria-label="Incorporation phases"
        className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
      >
        {phases.map((phase) => {
          const active = value === phase.id;
          return (
            <TabsTrigger key={phase.id} value={phase.id} className={internPhaseTabTrigger}>
              {internOverviewPhaseTitle(phase.id, phase.title)}
              {active ? (
                <MotionActivePill
                  layoutId={`${engagementId}-phase-tab-underline`}
                  reduced={reduceMotion}
                  className="absolute left-2 right-2 -bottom-px h-[2px] bg-brand"
                />
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
      </LayoutGroup>
      <div className="flex flex-col items-stretch gap-2 border-b border-border bg-muted/25 px-4 py-2.5">
        <span className="text-[11px] font-medium tabular-nums text-foreground">
          {internPhaseProgressLabel(selected.done, selected.total)}
        </span>
        <ProgressBar value={pct} className="h-1 bg-primary/25 [&>div]:bg-primary" />
      </div>
      <TabsContent value={value} className="mt-0 focus-visible:ring-0">
        <AnimatePresence mode="wait">
          <m.div
            key={value}
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={panelMotion.transition}
          >
            {children(value)}
          </m.div>
        </AnimatePresence>
      </TabsContent>
    </Tabs>
  );
}

/** Quiet category labels above intern Registration rows — same card, no nested surfaces. */
export function InternRegistrationGroupedRows({
  items,
  renderRow,
}: {
  items: readonly ChecklistItem[];
  renderRow: (item: ChecklistItem) => ReactNode;
}) {
  const groups = internRegistrationHeadingGroups(items);
  return (
    <div>
      {groups.map((group, index) => (
        <div key={group.heading} role="group" aria-label={group.heading}>
          <h3
            className={cn(
              'px-4 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary',
              index === 0 ? 'pt-2.5' : 'pt-3',
            )}
          >
            {group.heading}
          </h3>
          {group.items.map((item) => renderRow(item))}
        </div>
      ))}
    </div>
  );
}
