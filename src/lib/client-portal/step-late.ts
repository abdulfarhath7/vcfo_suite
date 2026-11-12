/**
 * The one rule for whether an incorporation checklist step is late.
 *
 * A step can be late only when it is open and not done. A locked step (kind 'up' or 'next':
 * the earlier steps are not done yet, see the sequential lock) is never late, even when its
 * planned window end has passed, because nobody can work on it yet. This is why the steps of
 * Phases 3 and 4 do not show as late or overdue before the Certificate of Incorporation.
 *
 * Pure. Used by the client portal step model, the staff client rows, the record timeline and
 * the client Incorporation page, so every surface agrees.
 */

/** Step kinds of the client portal step model (src/lib/client-portal/step-model.ts). */
export type LateStepKind = 'done' | 'you' | 'prog' | 'with' | 'next' | 'up';

/** True when the step is locked: earlier steps are not done, so nobody can work on it yet. */
export function isLockedStepKind(kind: LateStepKind): boolean {
  return kind === 'up' || kind === 'next';
}

/**
 * True when an open, not-done step is late: its stored status is overdue, or its window end
 * (`due`, yyyy-mm-dd) is before `today` (yyyy-mm-dd).
 */
export function isStepLate(step: { kind: LateStepKind; status?: string; due?: string }, today: string): boolean {
  if (step.kind === 'done' || isLockedStepKind(step.kind)) return false;
  return step.status === 'overdue' || (!!step.due && step.due < today);
}

/**
 * True when a built step carries the late overlay and is still open. Surfaces that read the
 * step model use this, so a step that became locked after the overlay was set is never late.
 */
export function isOpenLateStep(step: { kind: LateStepKind; late: boolean }): boolean {
  return step.late && step.kind !== 'done' && !isLockedStepKind(step.kind);
}

/** How many steps are open and late. */
export function countLateSteps(steps: readonly { kind: LateStepKind; late: boolean }[]): number {
  return steps.reduce((n, s) => n + (isOpenLateStep(s) ? 1 : 0), 0);
}
