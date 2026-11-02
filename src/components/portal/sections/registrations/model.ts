/**
 * Registrations — pure helpers over the real step model (phase 4 steps) and the
 * manual's SOPs (src/data/registration-sops.ts). No React here; tested in
 * model.test.ts.
 *
 * Status of a registration (prototype RST):
 *   live    the step is done (the registration is in hand)
 *   you     the client holds the next move: the step waits on the client, or a
 *           file SBC asked for is still open
 *   sbc     SBC (or the department) is working on it
 *   queued  not started yet — it opens later in the sequence
 *   na      not applicable to this company
 */
import type { ChecklistField } from '@/data/checklist';
import { extractItemResponses, getClientResponseFields } from '@/lib/checklist-responses';
import type { PortalStep } from '@/lib/client-portal/step-model';
import type { ClientFileRequestDto } from '@/lib/client-portal/incorporation-types';
import { REGISTRATION_GROUPS, type RegistrationSop, type SopWho } from '@/data/registration-sops';

export type RegStatus = 'live' | 'sbc' | 'you' | 'queued' | 'na';

export const REG_STATUS: Record<RegStatus, { pill: 'ok' | 'up' | 'due' | 'mut' | 'na'; label: string }> = {
  live: { pill: 'ok', label: 'Live' },
  sbc: { pill: 'up', label: 'With SBC' },
  you: { pill: 'due', label: 'Needs you' },
  queued: { pill: 'mut', label: 'Queued' },
  na: { pill: 'na', label: 'Not needed' },
};

export function isNotApplicable(s: PortalStep): boolean {
  return (s.slice?.status as string | undefined) === 'not-applicable';
}

export function regStatus(s: PortalStep, openRequests: number): RegStatus {
  if (isNotApplicable(s)) return 'na';
  if (s.kind === 'done') return 'live';
  if (s.kind === 'you' || openRequests > 0) return 'you';
  if (s.kind === 'prog' || s.kind === 'with') return 'sbc';
  return 'queued';
}

/** Open (unanswered) file requests on a step. */
export function openRequestsFor(stepId: string, requests: ClientFileRequestDto[] | undefined): ClientFileRequestDto[] {
  return (requests ?? []).filter((r) => r.stepId === stepId && !r.fulfilledAt);
}

/** The registration's reference as SBC recorded it (GSTIN, establishment code, LEI …), from the step's own fields. */
export function registrationReference(s: PortalStep): { label: string; value: string } | undefined {
  const fields = getClientResponseFields(s.item);
  const resp = extractItemResponses(s.item, s.slice ?? null);
  const f = fields.find((x: ChecklistField) => x.type !== 'file' && /(number|arn|code|gstin|id)$/i.test(x.id) && String(resp[x.id] ?? '').trim());
  if (!f) return undefined;
  const label = f.label.replace(/\s*[—-]\s*Company$/i, '').replace(/^.*\((\w+)\).*$/, '$1');
  return { label, value: String(resp[f.id]).trim() };
}

/** The date SBC recorded for the registration, else the step's done date. */
export function registrationDate(s: PortalStep): string | undefined {
  const fields = getClientResponseFields(s.item);
  const resp = extractItemResponses(s.item, s.slice ?? null);
  const f = fields.find((x) => /(registration|filing)Date$/i.test(x.id) && String(resp[x.id] ?? '').trim());
  const v = f ? String(resp[f.id]).trim() : '';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return s.doneOn;
}

export type ProcessState = 'done' | 'now' | 'up' | 'na';

/**
 * Where the registration is on the manual's chain (prototype processState, over
 * real signals instead of a stage counter):
 *   live   → every step done
 *   na     → every step not applicable
 *   queued → nothing started
 *   you    → the first client step is happening now; anything before it is done
 *   sbc    → the client's collection is done and SBC's first step after it is now;
 *            once SBC has recorded the reference number, only the last step
 *            (the certificate / approval) is still open
 */
export function processStates(sop: RegistrationSop, status: RegStatus, hasReference: boolean): ProcessState[] {
  const p = sop.process;
  if (status === 'live') return p.map(() => 'done');
  if (status === 'na') return p.map(() => 'na');
  if (status === 'queued') return p.map(() => 'up');
  const firstYou = p.findIndex((x) => x.who === 'YOU');
  if (status === 'you') return p.map((_, i) => (firstYou < 0 ? (i === 0 ? 'now' : 'up') : i < firstYou ? 'done' : i === firstYou ? 'now' : 'up'));
  // with SBC
  if (hasReference) return p.map((_, i) => (i < p.length - 1 ? 'done' : 'now'));
  const lastYou = (() => {
    let k = -1;
    p.forEach((x, i) => {
      if (x.who === 'YOU' && (k < 0 || i === k + 1)) k = i;
    });
    return k;
  })();
  return p.map((_, i) => (i <= lastYou ? 'done' : i === lastYou + 1 ? 'now' : 'up'));
}

export const WHO3: Record<SopWho, { label: string; bg: string; ink: string }> = {
  YOU: { label: 'You', bg: 'var(--due-bg)', ink: 'var(--due-ink)' },
  SBC: { label: 'SBC', bg: 'var(--ice-soft)', ink: 'var(--ice)' },
  GOVT: { label: 'Govt', bg: 'var(--hi)', ink: 'var(--ink-2)' },
};

/** Phase-4 steps grouped in the agreed order; steps not in any group go under "Other". */
export function groupRegistrations<T extends { id: string }>(steps: T[]): Array<{ name: string; steps: T[] }> {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: Array<{ name: string; steps: T[] }> = [];
  for (const g of REGISTRATION_GROUPS) {
    const list = g.stepIds.map((id) => byId.get(id)).filter((s): s is T => Boolean(s));
    list.forEach((s) => seen.add(s.id));
    if (list.length) out.push({ name: g.name, steps: list });
  }
  const rest = steps.filter((s) => !seen.has(s.id));
  if (rest.length) out.push({ name: 'Other', steps: rest });
  return out;
}

/** Catalog "infoRequired" rows as short paper names (first clause only). */
export function requiredPapers(s: PortalStep): string[] {
  return s.item.infoRequired.map((q) => (q.split(' — ')[0] ?? q).replace(/\s*\((?:if any|attachment)\)\s*$/i, '').trim()).filter(Boolean);
}
