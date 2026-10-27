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
import type { ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';
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
} from '@/lib/intern/intern-overview-progress';
import { cn } from '@/lib/utils';
import { fadeSwap, fadeSwapReduced, fadeUp, fadeUpReduced } from '@/lib/shell/motion';
import { InternPhaseTickTrack } from '@/components/incorporation/InternPhaseTickTrack';
import styles from './intern-engagement-overview.module.css';


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
        'rounded-xl border border-line bg-background/95 px-4 py-3 shadow-sm',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-0.5',
          now.waiting ? 'bg-warning' : 'bg-brand',
        )}
      />
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-[13px] leading-snug text-ink">
          <span className="font-medium text-ink-muted">You are here</span>
          <span className="text-ink-muted"> · </span>
          <span className="font-medium">{now.phaseTitle}</span>
          <span className="text-ink-muted"> · </span>
          <span className="tabular-nums">
            {now.stepNumber} of {now.stepTotal}
          </span>
          <span className="text-ink-muted"> · </span>
          <span>{now.stepTitle}</span>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'text-[12px] font-medium',
              now.waiting ? 'text-warning' : 'text-brand',
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
  metaForPhase,
  trailingForPhase,
}: {
  phases: readonly InternOverviewPhase[];
  gates: Record<string, ChecklistStepGate>;
  hrefForPhase: (phaseId: string) => string | null;
  /** Quiet metadata under the title — the manager's date window, when set. */
  metaForPhase?: (phaseId: string) => ReactNode;
  /** A link beside the chevron (the document pack pill). Rendered outside the row link. */
  trailingForPhase?: (phaseId: string) => ReactNode;
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
        const trailing = trailingForPhase?.(phase.id) ?? null;
        return (
          <div key={phase.id} className={styles.rowWrap} data-ask-focus={phase.id}>
          <Link
            href={href}
            aria-label={`${title}, ${internPhaseProgressLabel(doneCount, total)}`}
            aria-current={current ? 'step' : undefined}
            className={cn(styles.row, current && styles.rowCurrent, trailing && styles.rowWithTrailing)}
          >
            <span className={styles.rowLead}>
              <span className={styles.rowMark}>
                <InternStepDoneMark done={done} decorative className="h-5 w-5" />
              </span>
              <span className={styles.rowCopy}>
                <span className={styles.phaseTitle}>{title}</span>
                {subtitle ? <span className={styles.phaseSubtitle}>{subtitle}</span> : null}
                {metaForPhase?.(phase.id) ?? null}
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
          {trailing ? <span className={styles.rowTrailing}>{trailing}</span> : null}
          </div>
        );
      })}
    </nav>
  );
}

/* Phase tabs (K-09, rule R-11): small inline buttons, the picked tab navy. */
const internPhaseTabTrigger = cn('shrink-0 rounded-md bg-transparent px-2.5 h-7 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink data-[state=active]:bg-navy data-[state=active]:font-semibold data-[state=active]:text-on-navy data-[state=active]:shadow-none');

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
        className="m-3 mb-2 h-auto justify-start"
      >
        {phases.map((phase) => {
          return (
            <TabsTrigger key={phase.id} value={phase.id} className={internPhaseTabTrigger}>
              {internOverviewPhaseTitle(phase.id, phase.title)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      </LayoutGroup>
      <div className="flex flex-col items-stretch gap-2 border-b border-line bg-surface-sunken/25 px-4 py-2.5">
        <span className="text-[11px] font-medium tabular-nums text-ink">
          {internPhaseProgressLabel(selected.done, selected.total)}
        </span>
        <ProgressBar value={pct} className="h-1 bg-brand/25 [&>div]:bg-brand" />
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
              'px-4 pb-0.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint',
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
