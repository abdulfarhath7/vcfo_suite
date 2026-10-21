import { getIncorporationPhases } from '@/data/checklist';

/**
 * Manager-set date windows — "work on this between FROM and TO".
 *
 * Three scopes, in dependency order:
 *   1. incorporation — ONE window for SPICe+ Part A and Part B together
 *      (`engagements.schedule.incorporation`)
 *   2. per registration step (`engagements.schedule.steps[itemId]`)
 *   3. per compliance instance (`compliance_instances.window_from / window_to`)
 *
 * Only a manager, admin or super admin may write (enforced in the repository,
 * not just the UI). Leads and clients read. An unset window is normal: no
 * date, no warning. Windows replace the playbook working-days SLA copy — a
 * step shows a window when one is set and nothing otherwise.
 */
export interface ScheduleWindow {
  /** ISO calendar dates, inclusive. */
  from: string;
  to: string;
  setBy: string;
  setAt: string;
}

export interface EngagementSchedule {
  incorporation?: ScheduleWindow;
  steps?: Record<string, ScheduleWindow>;
}

export type ScheduleTarget = { kind: 'incorporation' } | { kind: 'step'; itemId: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** Both dates well-formed and FROM not after TO. */
export function isValidWindowRange(from: string, to: string): boolean {
  return isIsoDate(from) && isIsoDate(to) && from <= to;
}

function normalizeWindow(raw: unknown): ScheduleWindow | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  if (!isIsoDate(obj.from) || !isIsoDate(obj.to) || obj.from > obj.to) return undefined;
  return {
    from: obj.from,
    to: obj.to,
    setBy: typeof obj.setBy === 'string' ? obj.setBy : '',
    setAt: typeof obj.setAt === 'string' ? obj.setAt : '',
  };
}

export function normalizeEngagementSchedule(raw: unknown): EngagementSchedule {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: EngagementSchedule = {};
  const incorporation = normalizeWindow(obj.incorporation);
  if (incorporation) out.incorporation = incorporation;
  if (obj.steps && typeof obj.steps === 'object' && !Array.isArray(obj.steps)) {
    const steps: Record<string, ScheduleWindow> = {};
    for (const [itemId, value] of Object.entries(obj.steps as Record<string, unknown>)) {
      const window = normalizeWindow(value);
      if (window) steps[itemId] = window;
    }
    if (Object.keys(steps).length > 0) out.steps = steps;
  }
  return out;
}

/** Who may write windows. Mirrors the repository check; UI uses it to hide controls. */
export function canSetScheduleWindows(role: string | null | undefined): boolean {
  return role === 'manager' || role === 'admin' || role === 'super_admin';
}

const INCORPORATION_PHASE_IDS: ReadonlySet<string> = new Set(['pre-inc-phase-1', 'pre-inc-phase-2']);

let incorporationItemIds: ReadonlySet<string> | null = null;
/** Steps the single incorporation window covers: SPICe+ Part A and Part B. */
export function isIncorporationWindowStep(itemId: string): boolean {
  if (!incorporationItemIds) {
    incorporationItemIds = new Set(
      getIncorporationPhases()
        .filter((phase) => INCORPORATION_PHASE_IDS.has(phase.id))
        .flatMap((phase) => phase.items.map((item) => item.id)),
    );
  }
  return incorporationItemIds.has(itemId);
}

export function isIncorporationWindowPhase(phaseId: string): boolean {
  return INCORPORATION_PHASE_IDS.has(phaseId);
}

/** The window that applies to a step: its own, else the incorporation window when it is a Part A/B step. */
export function windowForStep(
  schedule: EngagementSchedule | null | undefined,
  itemId: string,
): ScheduleWindow | undefined {
  const own = schedule?.steps?.[itemId];
  if (own) return own;
  if (isIncorporationWindowStep(itemId)) return schedule?.incorporation;
  return undefined;
}

export function applyScheduleWindow(
  schedule: EngagementSchedule | null | undefined,
  target: ScheduleTarget,
  window: { from: string; to: string } | null,
  meta: { setBy: string; now: string },
): EngagementSchedule {
  const next: EngagementSchedule = {
    ...(schedule?.incorporation ? { incorporation: schedule.incorporation } : {}),
    ...(schedule?.steps ? { steps: { ...schedule.steps } } : {}),
  };
  const value: ScheduleWindow | undefined = window
    ? { from: window.from, to: window.to, setBy: meta.setBy, setAt: meta.now }
    : undefined;
  if (target.kind === 'incorporation') {
    if (value) next.incorporation = value;
    else delete next.incorporation;
    return next;
  }
  const steps = { ...(next.steps ?? {}) };
  if (value) steps[target.itemId] = value;
  else delete steps[target.itemId];
  if (Object.keys(steps).length > 0) next.steps = steps;
  else delete next.steps;
  return next;
}

const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `12 Sep – 19 Sep 2026`; the year once, on the end date. */
export function formatWindow(window: Pick<ScheduleWindow, 'from' | 'to'>): string {
  const from = new Date(`${window.from}T00:00:00Z`);
  const to = new Date(`${window.to}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return `${window.from} – ${window.to}`;
  if (window.from === window.to) return DAY_MONTH_YEAR.format(to);
  return `${DAY_MONTH.format(from)} – ${DAY_MONTH_YEAR.format(to)}`;
}
