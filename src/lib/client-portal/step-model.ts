/**
 * Client portal v7 — the incorporation step model every client page reads
 * (Home steps card, timeline, "Who holds it now", Incorporation landing,
 * phase and step pages, Documents progress bars, chat answers).
 *
 * Pure. Derives the prototype's step kinds from the REAL checklist state as
 * the client sees it (`checklistStateForViewer(ctx, …)` / `useApp()` state):
 *
 *   done  · Done                     gate done or not applicable
 *   you   · Waiting on <company>     the client's move (gate active and client-owned,
 *                                    awaiting the client's approval, a fill request,
 *                                    or sent back for a correction)
 *   prog  · In progress              client-owned, the client has started it
 *   with  · With SBC / With MCA      the firm's move (gate waiting, under review,
 *                                    awaiting the manager), or a later step the lead
 *                                    has already released and is working on
 *   next  · Next                     (landing table only) the first locked step
 *                                    right after the current one in the same phase
 *   up    · Upcoming                 locked
 *   late  (overlay)                  not done and past its window end / overdue
 *
 * The real gate (src/lib/checklist-step-gate.ts, LIFTed) is not changed: it
 * opens one step at a time. QUESTIONS.md › Incorporation records this.
 */
import { coerceStatusCode, getIncorporationPhases, type ChecklistItem } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { gateActiveCatalog, getStepGate, type ChecklistStepGate } from '@/lib/checklist-step-gate';
import { approvalStateOf } from '@/lib/checklist-step-approval';
import { isClientFillAwaitingClient } from '@/lib/checklist-client-fill';
import { isReviewRejected } from '@/lib/checklist-item-review';
import { isStepReleasedToClient } from '@/lib/checklist-visibility';
import { windowForStep, type EngagementSchedule } from '@/lib/schedule-windows';

export type StepKind = 'done' | 'you' | 'prog' | 'with' | 'next' | 'up';
export type StepOwner = 'client' | 'sbc' | 'mca';

export interface PortalStep {
  /** 1-based number across all 48 steps (prototype `inc-step-N`). */
  n: number;
  id: string;
  title: string;
  item: ChecklistItem;
  phaseId: string;
  /** 1–4. */
  phaseNo: number;
  owner: StepOwner;
  kind: StepKind;
  late: boolean;
  lateDays: number;
  /** ISO date (yyyy-mm-dd) or undefined. */
  doneOn?: string;
  due?: string;
  windowFrom?: string;
  /** With SBC since (best effort: submission / previous step done date). */
  since?: string;
  gate: ChecklistStepGate;
  canOpen: boolean;
  slice?: ChecklistItemStateSlice;
}

export interface PortalPhase {
  no: number;
  id: string;
  /** "Name Application" (without "Phase n — "). */
  name: string;
  title: string;
  section: string;
  steps: PortalStep[];
  done: number;
  total: number;
  state: 'done' | 'active' | 'up';
  currentStepId?: string;
  /** Latest due date among the phase's steps. */
  end?: string;
  start?: string;
}

export interface PortalIncorporationModel {
  phases: PortalPhase[];
  steps: PortalStep[];
  byId: Record<string, PortalStep>;
  spice: { done: number; total: number; pct: number };
  all: { done: number; total: number; pct: number };
  current?: PortalStep;
  counts: Record<StepKind | 'late', number>;
  /** Manager-set incorporation window end (expected COI before COI). */
  coiExpected?: string;
}

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  done: 'Done',
  you: 'Waiting',
  prog: 'In progress',
  with: 'With SBC',
  next: 'Next',
  up: 'Upcoming',
};

/** Prototype KCOL. */
export const STEP_KIND_COLOR: Record<Exclude<StepKind, 'next'>, string> = {
  done: '#15805f',
  you: '#c8620e',
  prog: '#0f2a4a',
  with: '#2453c7',
  up: '#8a97a8',
};

const MCA_STEPS = new Set(['pre-11', 'pre-12']);

function ymd(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function doneDate(slice?: ChecklistItemStateSlice): string | undefined {
  if (!slice) return undefined;
  const s = slice as ChecklistItemStateSlice & { approval?: { clientApprovedAt?: string } };
  return (
    ymd(s.approval?.clientApprovedAt) ??
    ymd(slice.completedOn) ??
    ymd(slice.deliveredToClientAt) ??
    (slice.reviewStatus === 'accepted' ? ymd(slice.reviewedAt) : undefined) ??
    ymd(slice.clientSubmittedAt)
  );
}

function hasClientResponses(slice?: ChecklistItemStateSlice): boolean {
  const r = slice?.responses;
  if (!r || typeof r !== 'object') return false;
  return Object.values(r as Record<string, unknown>).some((v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== ''));
}

export function buildIncorporationModel(
  state: Record<string, ChecklistItemStateSlice | undefined> | undefined,
  schedule?: EngagementSchedule | null,
  today: string = new Date().toISOString().slice(0, 10),
): PortalIncorporationModel {
  const st = state ?? {};
  const gates = gateActiveCatalog(st, 'client');
  const phases: PortalPhase[] = [];
  const steps: PortalStep[] = [];
  let n = 0;
  let prevDone: string | undefined;

  getIncorporationPhases().forEach((phase, pi) => {
    const out: PortalStep[] = [];
    for (const item of phase.items) {
      n += 1;
      const slice = st[item.id];
      const gate = getStepGate(gates, item.id);
      const status = coerceStatusCode(slice?.status);
      const approval = approvalStateOf(slice);
      const win = windowForStep(schedule, item.id);
      const owner: StepOwner = MCA_STEPS.has(item.id) ? 'mca' : item.responsibleRole === 'client' ? 'client' : 'sbc';
      let kind: StepKind;
      if (gate.kind === 'done' || status === 'not-applicable') kind = 'done';
      else if (
        approval === 'pending_client' ||
        isClientFillAwaitingClient(slice?.clientFillRequest) ||
        (gate.kind === 'active' && (item.responsibleRole === 'client' || isReviewRejected(slice)) && (!hasClientResponses(slice) || isReviewRejected(slice)))
      )
        kind = 'you';
      else if (gate.kind === 'active' && item.responsibleRole === 'client') kind = 'prog';
      else if (gate.kind === 'active' || gate.kind === 'waiting') kind = 'with';
      else if (isStepReleasedToClient(slice) && status === 'in-progress') kind = 'with';
      else kind = 'up';

      const due = ymd(win?.to);
      const doneOn = kind === 'done' ? doneDate(slice) : undefined;
      const late = kind !== 'done' && (status === 'overdue' || (!!due && due < today));
      const since = kind === 'with' ? ymd(slice?.clientSubmittedAt) ?? prevDone : undefined;
      const step: PortalStep = {
        n,
        id: item.id,
        title: item.title,
        item,
        phaseId: phase.id,
        phaseNo: pi + 1,
        owner,
        kind,
        late,
        lateDays: late && due ? Math.max(1, daysBetween(due, today)) : 0,
        doneOn,
        due,
        windowFrom: ymd(win?.from),
        since,
        gate,
        canOpen: gate.canOpen || kind === 'done',
        slice,
      };
      if (kind === 'done') prevDone = doneOn ?? prevDone;
      out.push(step);
      steps.push(step);
    }
    // landing "Next": the first locked step right after the current one in this phase
    const curIdx = out.findIndex((s) => s.kind === 'you' || s.kind === 'prog' || s.kind === 'with');
    if (curIdx >= 0) {
      const nx = out.slice(curIdx + 1).find((s) => s.kind === 'up');
      if (nx) nx.kind = 'next';
    }
    const done = out.filter((s) => s.kind === 'done').length;
    const allUp = out.every((s) => s.kind === 'up' || s.kind === 'next');
    const dues = out.map((s) => s.due).filter(Boolean) as string[];
    const froms = out.map((s) => s.windowFrom).filter(Boolean) as string[];
    phases.push({
      no: pi + 1,
      id: phase.id,
      title: phase.title,
      name: phase.title.replace(/^Phase\s+\d+\s+[—-]\s+/, ''),
      section: (phase as { section?: string }).section ?? '',
      steps: out,
      done,
      total: out.length,
      state: done === out.length ? 'done' : allUp ? 'up' : 'active',
      currentStepId: out.find((s) => s.kind !== 'done' && s.kind !== 'up' && s.kind !== 'next')?.id,
      end: dues.sort().at(-1),
      start: froms.sort()[0],
    });
  });

  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
  const spiceSteps = steps.filter((s) => s.phaseNo <= 2);
  const sd = spiceSteps.filter((s) => s.kind === 'done').length;
  const ad = steps.filter((s) => s.kind === 'done').length;
  const counts = { done: 0, you: 0, prog: 0, with: 0, next: 0, up: 0, late: 0 } as Record<StepKind | 'late', number>;
  for (const s of steps) {
    counts[s.kind] += 1;
    if (s.late) counts.late += 1;
  }
  return {
    phases,
    steps,
    byId,
    spice: { done: sd, total: spiceSteps.length, pct: spiceSteps.length ? Math.round((sd / spiceSteps.length) * 100) : 0 },
    all: { done: ad, total: steps.length, pct: steps.length ? Math.round((ad / steps.length) * 100) : 0 },
    current: steps.find((s) => s.kind === 'you') ?? steps.find((s) => s.kind === 'prog' || s.kind === 'with'),
    counts,
    coiExpected: ymd(schedule?.incorporation?.to),
  };
}

/** "4 Oct" */
export function shortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
