import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { normalizeEngagementChecklistState } from '@/lib/checklist-state-key';

/** Dates the compliance calendar reads from checklist responses. */
export const CHECKLIST_INDEX_TRIGGER_FIELDS = [
  'dateOfIncorporation',
  'gstRegistrationDate',
  'pfRegistrationDate',
  'esiRegistrationDate',
  'panTanAllotmentDate',
] as const;

export type EngagementChecklistState = Record<string, ChecklistItemStateSlice>;

export function checklistStateHasResponses(state: EngagementChecklistState): boolean {
  for (const slice of Object.values(state)) {
    if (slice.responses && Object.keys(slice.responses).length > 0) return true;
  }
  return false;
}

function slimResponses(responses: unknown): Record<string, string> | undefined {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) return undefined;
  const bag = responses as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of CHECKLIST_INDEX_TRIGGER_FIELDS) {
    const value = bag[key];
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Drop bulky answers/notes while keeping status + sequential-gate fields
 * and the few dates Today / dashboards / the compliance rail need.
 */
export function slimChecklistIndexState(
  raw: Record<string, unknown>,
): EngagementChecklistState {
  const slim: Record<string, unknown> = {};
  for (const [itemId, slice] of Object.entries(raw)) {
    if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
      slim[itemId] = { status: 'not-started' };
      continue;
    }
    const obj = { ...(slice as Record<string, unknown>) };
    delete obj.notes;
    const responses = slimResponses(obj.responses);
    if (responses) obj.responses = responses;
    else delete obj.responses;
    slim[itemId] = obj;
  }
  return normalizeEngagementChecklistState(slim);
}

function checklistIndexEqual(
  a: EngagementChecklistState,
  b: EngagementChecklistState,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Overlay a slim board onto local state. Full step/vault payloads (any responses)
 * win so a later index refetch cannot wipe file paths or form answers.
 */
export function mergeChecklistIndexIntoState(
  prev: Record<string, EngagementChecklistState>,
  next: Record<string, EngagementChecklistState>,
): Record<string, EngagementChecklistState> {
  let changed = false;
  const out: Record<string, EngagementChecklistState> = { ...prev };
  for (const [id, slim] of Object.entries(next)) {
    const existing = prev[id];
    if (existing && checklistStateHasResponses(existing)) continue;
    if (existing === slim || (existing && checklistIndexEqual(existing, slim))) continue;
    out[id] = slim;
    changed = true;
  }
  if (!changed) return prev;
  return out;
}
