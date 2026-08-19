'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { getStepGate } from '@/lib/checklist-step-gate';
import { cn } from '@/lib/utils';
import { InternStepDoneMark } from '@/components/incorporation/InternStepDoneMark';
import styles from './intern-engagement-overview.module.css';

/**
 * Intern engagement phase stepper. Isolated on purpose:
 * set INTERN_PHASE_STEPPER_ENABLED to false, or delete this file and its one
 * JSX mount in intern EngagementDetail.
 */
export const INTERN_PHASE_STEPPER_ENABLED = true;

export type InternPhaseStepperPhase = {
  id: string;
  title: string;
  items: readonly { id: string; title: string }[];
};

function stepDone(gates: Record<string, ChecklistStepGate>, itemId: string): boolean {
  return getStepGate(gates, itemId).kind === 'done';
}

function phaseDone(
  items: InternPhaseStepperPhase['items'],
  gates: Record<string, ChecklistStepGate>,
): boolean {
  return items.length > 0 && items.every((item) => stepDone(gates, item.id));
}

function PhaseConnector() {
  return (
    <div className={styles.connector} aria-hidden>
      <span className={styles.connectorLine} />
    </div>
  );
}

function PhaseNode({
  done,
  current,
  label,
  completeLabel,
  href,
  onSelect,
}: {
  done: boolean;
  current: boolean;
  label: string;
  completeLabel: string;
  href?: string | null;
  onSelect?: () => void;
}) {
  const className = cn(
    styles.node,
    (href || onSelect) && styles.nodeInteractive,
    current && !done && styles.nodeCurrent,
  );
  const aria = `${label}, ${completeLabel}`;
  const mark = <InternStepDoneMark done={done} decorative className="h-3.5 w-3.5" />;

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        aria-label={aria}
        aria-current={current ? 'step' : undefined}
      >
        {mark}
      </Link>
    );
  }

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        onClick={onSelect}
        aria-label={aria}
        aria-current={current ? 'step' : undefined}
      >
        {mark}
      </button>
    );
  }

  return (
    <div className={className} aria-current={current ? 'step' : undefined}>
      {mark}
      <span className="sr-only">{aria}</span>
    </div>
  );
}

export function InternPhaseStepper({
  phases,
  gates,
  currentPhaseId = null,
  hrefForPhase,
  onSelectPhase,
}: {
  phases: readonly InternPhaseStepperPhase[];
  gates: Record<string, ChecklistStepGate>;
  currentPhaseId?: string | null;
  hrefForPhase?: (phaseId: string) => string | null;
  onSelectPhase?: (phaseId: string) => void;
}) {
  if (phases.length === 0) return null;

  const lastIndex = phases.length - 1;
  const columns = phases
    .map((_, index) => (index === lastIndex ? 'auto' : 'auto minmax(0,1fr)'))
    .join(' ');

  return (
    <nav aria-label="Incorporation phase progress" className={styles.stepper}>
      <div className={styles.stepperGrid} style={{ gridTemplateColumns: columns }}>
        {phases.map((phase, index) => {
          const done = phaseDone(phase.items, gates);
          const completeCount = phase.items.filter((item) => stepDone(gates, item.id)).length;
          return (
            <Fragment key={phase.id}>
              <PhaseNode
                done={done}
                current={currentPhaseId === phase.id}
                label={phase.title}
                completeLabel={`${completeCount} of ${phase.items.length} complete`}
                href={hrefForPhase?.(phase.id)}
                onSelect={onSelectPhase ? () => onSelectPhase(phase.id) : undefined}
              />
              {index < lastIndex ? <PhaseConnector /> : null}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
