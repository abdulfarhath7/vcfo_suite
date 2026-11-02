/**
 * Incorporation section — pure helpers between the real step model
 * (src/lib/client-portal/step-model.ts) and the prototype's step vocabulary
 * (a1_core.js STEPS / SST / SCOL / OWNER, a3_inc.js phaseInfo).
 *
 *   model kind            → prototype state
 *   done (gate done / NA) → done, or na when the step is marked not applicable
 *   late (not done)       → over
 *   you                   → you
 *   prog / with           → prog
 *   next / up             → up
 *
 * Copy for phases comes from the previous client portal (pages/incorporation/data.ts)
 * and the prototype (PHASE_NAMES / PHASE_SUB). Step text comes from the checklist
 * catalog (description, notes, infoRequired) — never sample text.
 */
import { coerceStatusCode, getActiveCatalogItems, getChecklistStepTimelineLabel, type ChecklistItem } from '@/data/checklist';
import { resolveChecklistItemFromStepParam } from '@/lib/slug';
import type { PortalPhase, PortalStep } from '@/lib/client-portal/step-model';

export type ProtoState = 'done' | 'prog' | 'you' | 'over' | 'up' | 'na';
export type ProtoOwner = 'you' | 'sbc' | 'gov';

/** Prototype SST. */
export const SST: Record<ProtoState, string> = { done: 'Done', prog: 'In progress', you: 'Needs you', over: 'Overdue', up: 'Queued', na: 'Not needed' };
/** Prototype SCOL (search swatches, rings). */
export const SCOL: Record<ProtoState, string> = { done: 'var(--ok-green)', prog: 'var(--ice)', you: 'var(--due)', over: 'var(--over)', up: 'var(--line)', na: 'var(--line-2)' };
/** Owner label: the government body for steps 11–12 is the MCA. */
export const OWNER: Record<ProtoOwner, string> = { you: 'You', sbc: 'SBC', gov: 'MCA' };

/** Prototype PHASE_NAMES (= the previous portal's PHL) and PHASE_SUB. */
export const PHASE_NAMES = ['SPICe+ Part A', 'SPICe+ Part B', 'Post-incorporation', 'Registration'];
export const PHASE_SUB = ['Name reservation', 'Incorporation filing', 'After the company exists', 'Tax, labour and trade registrations'];

/** Previous client portal copy (pages/incorporation/data.ts phInfo / phWhy / PH_WAIT). */
export const phInfo = (s: string): string[] => [
  `Name approval with MCA (SPICe+ Part A): ${s}’s details, the board resolution, and the name application SBC files for ${s}.`,
  'SPICe+ Part B: capital, registered office, directors and subscribers, KYC and DSC, the filing, and the Certificate of Incorporation.',
  'What a new company must do in its first months: board meeting, bank account, share capital, share certificates and ROC filings.',
  'The registrations the company needs to operate, grouped as in VCFO Suite: General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand and FEMA.',
];
export const phWhy = (s: string): string[] => [
  'Nothing else can start until MCA approves the company name.',
  `It ends with the Certificate of Incorporation: ${s} exists from that date.`,
  'Most of these have legal deadlines counted from the incorporation date (30 to 180 days).',
  'The company needs these to invoice, hire and trade; GST comes first.',
];
export const PH_WAIT = ['', '', 'Post-incorporation starts once the Certificate of Incorporation is issued.', 'Registrations start after the Certificate of Incorporation. GST comes first.'];

export function isNotApplicable(s: PortalStep): boolean {
  return coerceStatusCode(s.slice?.status) === 'not-applicable';
}

export function protoState(s: PortalStep): ProtoState {
  if (s.kind === 'done') return isNotApplicable(s) ? 'na' : 'done';
  if (s.late) return 'over';
  if (s.kind === 'you') return 'you';
  if (s.kind === 'prog' || s.kind === 'with') return 'prog';
  return 'up';
}

export function protoOwner(s: PortalStep): ProtoOwner {
  return s.owner === 'client' ? 'you' : s.owner === 'mca' ? 'gov' : 'sbc';
}

/** Prototype phaseInfo(pi) over the real phase: applicable steps, done count, current step, status. */
export function phaseInfo(p: PortalPhase) {
  const app = p.steps.filter((s) => !isNotApplicable(s));
  const done = app.filter((s) => s.kind === 'done').length;
  const st = (s: PortalStep) => protoState(s);
  const cur =
    app.find((s) => st(s) === 'over') ??
    app.find((s) => st(s) === 'you') ??
    app.find((s) => st(s) === 'prog') ??
    app.find((s) => st(s) === 'up');
  const status: 'Complete' | 'In progress' | 'Not started' =
    done === app.length || p.state === 'done' ? 'Complete' : p.state === 'up' ? 'Not started' : 'In progress';
  return { steps: p.steps, app, done, cur, status, pct: app.length ? Math.round((done / app.length) * 100) : 0 };
}

/** A step id ("pre-13") or catalog slug ("capital-structure") → the active catalog item id. */
export function resolveStepId(param: string): string | undefined {
  const raw = param.trim();
  if (!raw) return undefined;
  const active = getActiveCatalogItems();
  const direct = active.find((c) => c.id === raw || c.slug === raw);
  if (direct) return direct.id;
  const item = resolveChecklistItemFromStepParam(raw);
  return item && active.some((c) => c.id === item.id) ? item.id : undefined;
}

/** Plain description of a step from the catalog. */
export function stepDescription(item: ChecklistItem): string {
  return (item.description ?? item.notes ?? '').trim();
}

/** "What it needs" rows: the catalog's infoRequired, first clause only (as the previous portal did). */
export function stepNeeds(item: ChecklistItem): string[] {
  return item.infoRequired.map((q) => (q.split(' — ')[0] ?? q).replace(/\s*\((?:if any|attachment)\)\s*$/i, '').trim()).filter(Boolean);
}

/** The step's timeline rule ("30 days from incorporation", playbook SLA …). */
export function stepTimeline(item: ChecklistItem): string {
  try {
    return getChecklistStepTimelineLabel(item);
  } catch {
    return '';
  }
}

/** Steps that are one statutory filing on the register (prototype STEP_FILING). */
export const STEP_FILING: Record<string, RegExp> = {
  'post-7': /FC-?GPR/i,
  'reg-20': /FC-?GPR/i,
  'post-6': /INC-?20A/i,
  'post-5': /SH-?1\b/i,
  'post-2': /ADT-?1\b/i,
};

/** Registration steps live in the Registrations section. */
export const isRegistrationStep = (id: string): boolean => id.startsWith('reg-');
