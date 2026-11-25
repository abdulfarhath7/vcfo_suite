'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { StepMark } from '@/components/ui/step-track';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { RecordPhaseBar, RecordPhaseTrack } from '@/components/incorporation/RecordPhaseTrack';
import { Chip } from '@/components/ui/spectrum-chip';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { ChecklistItem } from '@/data/checklist';
import type { ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';
import {
  internEngagementOpenPhasesDefault,
  internNodeKind,
  internOverviewPhaseTitle,
  internPhaseProgressFraction,
  internPhaseProgressLabel,
  internPhaseStepCounts,
  internRegistrationHeadingGroups,
  readInternEngagementOpenPhases,
  writeInternEngagementOpenPhases,
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
 *
 * VCFO Spectrum (C-0108, R-22, R-36): on. The record shows the ST5 phase track and the picked
 * phase's step list in place, as the prototype's client record does. The entry cards' window
 * meta and document pack pill move into the step card's head, so nothing is lost.
 */
export const INTERN_PHASE_TABS_ENABLED = true;

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
                <StepMark state={done ? 'done' : current ? 'now' : 'next'} />
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

export type InternPhaseTab = {
  id: string;
  title: string;
  done: number;
  total: number;
  /** "Steps 1–5" under the phase bar. */
  range?: string;
  /** The name over the phase bar; the catalog's phase title when absent. */
  label?: string;
};

/**
 * The step card of a lead's client record. The ST5 phase track sits on top as the progress
 * summary, and each phase below it is a collapsible section whose header repeats the phase's bar,
 * its done count and a status chip. The current phase opens by default; several can be open at
 * once, and the open sections are kept per engagement. A bar opens its section and scrolls to it.
 * `children(phaseId)` renders a section's steps, only while it is open.
 */
export function InternPhaseSections({
  engagementId,
  currentPhaseId,
  phases,
  openPhaseId,
  headAction,
  headMeta,
  children,
}: {
  engagementId: string;
  currentPhaseId: string | null;
  phases: readonly InternPhaseTab[];
  /** Opens this phase and scrolls to it (`?phase=n` from a phase bar in a list). */
  openPhaseId?: string | null;
  /** Right-hand head action, such as "Open current step". */
  headAction?: ReactNode;
  /** The head's muted count; "x of y done" by default. */
  headMeta?: ReactNode;
  children: (phaseId: string) => ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const phaseIds = phases.map((phase) => phase.id);
  const phaseKey = phaseIds.join(',');
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  const [open, setOpen] = useState<string[]>(() =>
    internEngagementOpenPhasesDefault(null, currentPhaseId, phaseIds),
  );

  // Re-runs when the current phase settles (the gates load after the card mounts), so a viewer
  // with nothing stored lands on the phase in progress. A stored list is unaffected by that.
  useLayoutEffect(() => {
    const ids = phaseKey ? phaseKey.split(',') : [];
    const next = internEngagementOpenPhasesDefault(
      readInternEngagementOpenPhases(engagementId),
      currentPhaseId,
      ids,
    );
    if (openPhaseId && ids.includes(openPhaseId)) {
      setOpen(next.includes(openPhaseId) ? next : [...next, openPhaseId]);
      setScrollTo(openPhaseId);
    } else {
      setOpen(next);
    }
  }, [engagementId, openPhaseId, phaseKey, currentPhaseId]);

  useEffect(() => {
    if (!scrollTo) return;
    sectionRefs.current.get(scrollTo)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    setScrollTo(null);
  }, [scrollTo, reduceMotion]);

  if (phases.length === 0) return null;

  const update = (next: string[]) => {
    // Keep the catalog order so the stored list reads the same however it was opened.
    const ordered = phaseIds.filter((id) => next.includes(id));
    setOpen(ordered);
    writeInternEngagementOpenPhases(engagementId, ordered);
  };
  const toggle = (id: string) => update(open.includes(id) ? open.filter((x) => x !== id) : [...open, id]);
  const jumpTo = (id: string) => {
    if (!open.includes(id)) update([...open, id]);
    setScrollTo(id);
  };

  const totalDone = phases.reduce((n, p) => n + p.done, 0);
  const total = phases.reduce((n, p) => n + p.total, 0);
  // The track's rule: the current phase is the first one not yet finished.
  const trackCurrent = phases.find((p) => p.done < p.total)?.id ?? null;
  const allOpen = open.length === phases.length;
  const bodyMotion = reduceMotion ? fadeSwapReduced : fadeSwap;

  return (
    <section className="surface min-w-0 overflow-hidden" aria-label="Incorporation phases">
      <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft px-4 py-2 md:px-5">
        <CardHeadTile title="Steps" />
        <h2 className="whitespace-nowrap text-[15px] font-medium text-ink">Steps</h2>
        <span className="truncate text-[13px] tabular-nums text-ink-muted">
          {headMeta ?? `${totalDone} of ${total} done`}
        </span>
        <span className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => update(allOpen ? [] : phaseIds)}
            className="shrink-0 text-[13px] text-ink-muted hover:text-ink hover:underline"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
          {headAction}
        </span>
      </div>
      <div className="border-b border-line-soft p-4 md:px-5">
        <RecordPhaseTrack
          phases={phases.map((p) => ({ id: p.id, label: p.label ?? internOverviewPhaseTitle(p.id, p.title), done: p.done, total: p.total, range: p.range }))}
          onPick={jumpTo}
        />
      </div>
      <div>
        {phases.map((phase) => {
          const label = phase.label ?? internOverviewPhaseTitle(phase.id, phase.title);
          const isOpen = open.includes(phase.id);
          const full = phase.total > 0 && phase.done >= phase.total;
          const current = phase.id === trackCurrent;
          const chip = full ? 'Done' : current || phase.done > 0 ? 'In progress' : 'Not started';
          const bodyId = `phase-section-${phase.id}`;
          return (
            <div
              key={phase.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(phase.id, el);
                else sectionRefs.current.delete(phase.id);
              }}
              className="scroll-mt-20 border-b border-line-soft last:border-b-0"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => toggle(phase.id)}
                className="grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken/60 md:px-5"
              >
                <ChevronRight
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden
                  className={cn(
                    'transition-transform duration-150 motion-reduce:transition-none',
                    isOpen ? 'rotate-90 text-ink' : 'text-ink-muted',
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14.5px] font-medium text-ink">{label}</span>
                  {phase.range ? (
                    <span className="truncate font-mono text-[12px] text-ink-muted">{phase.range}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <RecordPhaseBar
                    done={phase.done}
                    total={phase.total}
                    current={current}
                    className="hidden h-2 w-24 sm:block"
                  />
                  <span
                    className={cn(
                      'min-w-[2.25rem] text-right text-[12.5px] font-medium tabular-nums',
                      full ? 'text-positive' : current ? 'text-brand-text' : 'text-ink-muted',
                    )}
                  >
                    {phase.done}/{phase.total}
                  </span>
                  <Chip>{chip}</Chip>
                </span>
              </button>
              {/* Fades in on open only: a closing section leaves at once, so the sections below
                  do not jump after a scroll has been measured. */}
              {isOpen ? (
                <m.div
                  id={bodyId}
                  role="region"
                  aria-label={label}
                  initial={bodyMotion.initial}
                  animate={bodyMotion.animate}
                  transition={bodyMotion.transition}
                  className="px-4 pb-3 md:px-5 md:pl-12"
                >
                  {children(phase.id)}
                </m.div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
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
              'border-b border-line-soft px-4 pb-1.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted',
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
