import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import type { ChipTone } from '@/components/ui/spectrum-chip';
import { buildIncorporationModel, type PortalStep } from '@/lib/client-portal/step-model';
import { countLateSteps } from '@/lib/client-portal/step-late';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { internCompanyPhaseProgress, type InternCompanyPhaseProgress } from '@/lib/intern/intern-work';
import { deriveStuckReason, type StuckReason } from '@/lib/projects/project-stuck';
import type { EngagementSchedule } from '@/lib/projects/schedule-windows';
import { sep } from '@/lib/date-format';
import { todayIST } from '@/lib/compliance/filings';

/**
 * CLIENT ROW FACTS for the staff Clients lists (lead Clients, manager Projects, admin Work ›
 * Projects and the admin home "Clients" card; prototype `ClientsGrid`). Every value is derived
 * from the engagement row and its checklist state; nothing is stored for the list itself. The
 * functions are pure, so the pages and the GL-06 Excel export on the server share them.
 *
 *   stage   — Incorporating until the company is incorporated (`isIncorporated`), then Compliance.
 *   now     — the current step of the client step model (`buildIncorporationModel`): its code
 *             ("Step 13", "Reg-12"), its title and who holds it (client, SBC or MCA).
 *   next    — the earliest manager-set window end still ahead (or the latest one if all passed).
 *   health  — one of the prototype's six words, plus Done when every step is finished.
 */

export type ClientStage = 'incorporating' | 'compliance';
export type ClientHolder = 'client' | 'sbc' | 'mca';
export type ClientHealth = 'Stuck' | 'Overdue' | 'Due this week' | 'With client' | 'In progress' | 'Not started' | 'Done';

export const CLIENT_HEALTHS: ClientHealth[] = ['Stuck', 'Overdue', 'Due this week', 'With client', 'In progress', 'Not started', 'Done'];

export const HEALTH_TONE: Record<ClientHealth, ChipTone> = {
  Stuck: 'bad',
  Overdue: 'bad',
  'Due this week': 'warn',
  'With client': 'teal',
  'In progress': 'prog',
  'Not started': 'idle',
  Done: 'ok',
};

/** Worst first, for the admin list's sort. */
export const HEALTH_RANK: Record<ClientHealth, number> = {
  Stuck: 0,
  Overdue: 1,
  'Due this week': 2,
  'With client': 3,
  'In progress': 4,
  'Not started': 5,
  Done: 6,
};

export const STAGE_WORD: Record<ClientStage, string> = { incorporating: 'Incorporating', compliance: 'Compliance' };
export const STAGE_CHIP_TONE: Record<ClientStage, ChipTone> = { incorporating: 'violet', compliance: 'teal' };

export interface ClientNow {
  code: string;
  title: string;
  holder: ClientHolder;
}

export interface ClientRowFacts {
  stage: ClientStage;
  now: ClientNow | null;
  next: string | null;
  health: ClientHealth;
  stuckReason: StuckReason;
  progress: InternCompanyPhaseProgress;
  done: number;
  total: number;
}

/** "Step 13", counted across the phases, and "Reg-n" for the registration phase (prototype K-27). */
export function stepCode(step: Pick<PortalStep, 'phaseNo'>, indexInPhase: number, stepsBefore = 0): string {
  return step.phaseNo === 4 ? `Reg-${indexInPhase + 1}` : `Step ${stepsBefore + indexInPhase + 1}`;
}

/** The earliest window end that is still ahead (or the latest one if all have passed). */
export function nextScheduleDate(schedule: EngagementSchedule | null | undefined, todayIso: string): string | null {
  const ends = [schedule?.incorporation?.to, ...Object.values(schedule?.steps ?? {}).map((w) => w?.to)].filter(
    (d): d is string => Boolean(d),
  );
  if (ends.length === 0) return null;
  const ahead = ends.filter((d) => d >= todayIso).sort();
  return ahead[0] ?? ends.sort().at(-1) ?? null;
}

/** "14 Oct". */
export function shortDate(iso: string): string {
  return sep(new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Monday to Sunday of the week that holds `todayIso`, or of the week after it. */
function weekRange(todayIso: string, which: 'week' | 'next'): [string, string] {
  const dow = (new Date(`${todayIso}T00:00:00Z`).getUTCDay() + 6) % 7;
  const mon = addDays(todayIso, -dow + (which === 'next' ? 7 : 0));
  return [mon, addDays(mon, 6)];
}

/** Next date filter of the lists: the next window end falls in this week or next week. */
export function nextInWeek(next: string | null, todayIso: string, which: string): boolean {
  if (which !== 'week' && which !== 'next') return true;
  if (!next) return false;
  const [a, b] = weekRange(todayIso, which);
  return next >= a && next <= b;
}

/** The next manager-set window end (YYYY-MM-DD) falls within seven days from today. */
export function windowEndsThisWeek(schedule: EngagementSchedule | null | undefined, now = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const ends = [schedule?.incorporation?.to, ...Object.values(schedule?.steps ?? {}).map((w) => w?.to)].filter(
    (d): d is string => Boolean(d),
  );
  return ends.some((d) => d.slice(0, 10) >= today && d.slice(0, 10) <= end);
}

export function clientRowFacts(
  e: Engagement,
  state: Record<string, ChecklistItemStateSlice>,
  now: Date = new Date(),
): ClientRowFacts {
  const todayIso = todayIST(now);
  const progress = internCompanyPhaseProgress(e, state, now);
  const done = progress.phases.reduce((n, p) => n + p.done, 0);
  const total = progress.phases.reduce((n, p) => n + p.total, 0);
  const model = buildIncorporationModel(state, e.schedule, todayIso);
  const cur = model.current;
  let current: ClientNow | null = null;
  if (cur) {
    const phase = model.phases.find((p) => p.id === cur.phaseId);
    const idx = phase ? phase.steps.findIndex((s) => s.id === cur.id) : 0;
    const before = model.phases.filter((p) => p.no < cur.phaseNo).reduce((n, p) => n + p.steps.length, 0);
    current = {
      code: stepCode(cur, Math.max(0, idx), before),
      title: cur.title,
      holder: cur.owner === 'mca' ? 'mca' : cur.kind === 'you' || cur.kind === 'prog' ? 'client' : 'sbc',
    };
  }
  const stuckReason = deriveStuckReason(e, state);
  const next = nextScheduleDate(e.schedule, todayIso);
  let health: ClientHealth;
  if (total > 0 && done >= total) health = 'Done';
  else if (progress.stuck || stuckReason === 'blocked') health = 'Stuck';
  else if (e.health === 'overdue' || countLateSteps(model.steps) > 0) health = 'Overdue';
  else if (nextInWeek(next, todayIso, 'week')) health = 'Due this week';
  else if (stuckReason === 'waiting_client' || current?.holder === 'client') health = 'With client';
  else if (done === 0) health = 'Not started';
  else health = 'In progress';
  return {
    stage: isIncorporated(e, state) ? 'compliance' : 'incorporating',
    now: current,
    next,
    health,
    stuckReason,
    progress,
    done,
    total,
  };
}
