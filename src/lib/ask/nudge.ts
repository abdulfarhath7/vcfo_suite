import type { AnswerLink, ProjectSnapshot } from '@/data/ask/schema';
import { topicsForStep } from '@/lib/ask/topics';

/**
 * C1 daily nudge (§9A): one card, at most once a day, for the single next
 * step that is the client's to do. Never for a locked step or a step the
 * firm holds. No model call.
 */
export interface Nudge {
  stepId: string;
  title: string;
  dueLabel?: string;
  effortLabel?: string;
  link: AnswerLink;
}

/** Calendar day in India, where the firm and its deadlines live. */
export function indiaDay(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function buildNudge(snapshot: ProjectSnapshot): Nudge | null {
  const step = snapshot.currentStep;
  // `waiting on you` is only ever the client's own, unlocked step.
  if (!step || step.owner !== 'client' || step.status !== 'waiting on you') return null;
  const effortLabel = topicsForStep(step.id).find((t) => t.effortLabel)?.effortLabel;
  return {
    stepId: step.id,
    title: step.title,
    ...(step.dueLabel ? { dueLabel: step.dueLabel } : {}),
    ...(effortLabel ? { effortLabel } : {}),
    link: { dest: { to: 'step', stepId: step.id }, label: 'Open this step', primary: true },
  };
}

export function shouldShowNudge(
  prefs: { lastNudgeAt: Date | null; dismissedUntil: Date | null } | null,
  now: Date,
): boolean {
  if (!prefs) return true;
  if (prefs.dismissedUntil && prefs.dismissedUntil > now) return false;
  if (prefs.lastNudgeAt && indiaDay(prefs.lastNudgeAt) === indiaDay(now)) return false;
  return true;
}

/** Dismissed until the start of the next India calendar day. */
export function endOfIndiaDay(now: Date): Date {
  const day = indiaDay(now);
  return new Date(`${day}T23:59:59.999+05:30`);
}
