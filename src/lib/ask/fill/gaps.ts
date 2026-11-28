import { getItem } from '@/data/checklist';
import type { RequestItemKind } from '@/data/request-templates';
import { fieldOf } from '@/lib/actions/checklist/rules';
import { countryFromAddress, inferIndianState } from '@/lib/incorporation/countries';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { isDirectFlowStepComplete, isLeadOnlyField } from '@/lib/incorporation/pre-inc-direct-flow';
import { stepMissingKeys, type CompletenessEngagement } from '@/lib/incorporation/step-completeness';

/**
 * The gaps ladder of a "fill everything" run (owner brief, 28 Nov 2026). For every required answer a
 * step still lacks once the card's values are counted, in this order:
 *
 *   1. already in the app: nothing to do (it is not a gap);
 *   2. in the documents: the card already holds it, and the fill saves it as a draft with its file;
 *   3. derivable from what is known: filled as a draft marked "suggested", with the reason;
 *   4. only the client knows it: one item on a single draft "Ask client" request list (never sent);
 *   5. otherwise left, with the reason.
 *
 * Pure: the caller (`everything.ts`) reads the project and the card, and writes the rows and the list.
 */

export type StepState = Record<string, ChecklistItemStateSlice | undefined>;

export type GapRung = 'suggested' | 'ask_client' | 'left';

export interface GapField {
  stepId: string;
  /** The validator's key: a field id, or `group.entry.field` inside a list. */
  key: string;
  label: string;
  rung: GapRung;
  /** A suggested value and why it follows from what is known. */
  suggestion?: { fieldId: string; value: string; why: string };
  /** What the client is asked for: a document for a file field, else an answer. */
  kind?: RequestItemKind;
  /** Why the field is left, for the closing message. */
  reason?: string;
}

export interface GapInput {
  stepIds: readonly string[];
  /** The project's saved checklist. */
  state: StepState;
  engagement?: CompletenessEngagement | null;
  /** The card's values per step and response key, as the fill will save them. */
  cardValues: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** The saved answers with the card's values laid over them, so a gap is what neither holds. */
export function overlayState(state: StepState, cardValues: GapInput['cardValues']): StepState {
  const out: StepState = { ...state };
  for (const [stepId, values] of Object.entries(cardValues)) {
    const slice = out[stepId] ?? ({ status: 'in-progress', responses: {} } as unknown as ChecklistItemStateSlice);
    const responses: Record<string, string> = { ...(slice.responses ?? {}) };
    for (const [key, value] of Object.entries(values)) {
      if (!value.trim()) continue;
      responses[key] = value;
      // A new entry of a list (a director the card adds) joins the list's ids.
      const [group, entryId, field] = key.split('.');
      if (group && entryId && field) {
        const ids = (responses[group] ?? '').split(',').filter(Boolean);
        if (!ids.includes(entryId)) responses[group] = [...ids, entryId].join(',');
      }
    }
    out[stepId] = { ...slice, responses } as ChecklistItemStateSlice;
  }
  return out;
}

const valueAt = (state: StepState, stepId: string, key: string) => (state[stepId]?.responses?.[key] ?? '').trim();

const amount = (text: string): number | null => {
  const clean = text.replace(/(?:inr|rs\.?|₹|\/-)/gi, '').replace(/[,\s]/g, '');
  return /^\d+(?:\.\d+)?$/.test(clean) ? Number(clean) : null;
};

interface Derivation {
  stepId: string;
  fieldId: string;
  derive: (state: StepState) => { value: string; why: string } | null;
}

/**
 * What follows from what is known. Each one fills only an empty answer, and only with a value the
 * field accepts; the card shows the reason beside it, so the person can change it.
 */
export const DERIVATIONS: readonly Derivation[] = [
  {
    stepId: 'pre-1',
    fieldId: 'nominalValuePerEquityShare',
    derive: () => ({ value: '10', why: 'INR 10 is the usual face value of one equity share; please confirm.' }),
  },
  {
    stepId: 'pre-1',
    fieldId: 'parentEntityCountry',
    derive: (state) => {
      const value = countryFromAddress(valueAt(state, 'pre-1', 'parentEntityAddress'));
      return value ? { value, why: "Taken from the foreign entity's address." } : null;
    },
  },
  {
    stepId: 'pre-13',
    fieldId: 'equityShares',
    derive: (state) => (valueAt(state, 'pre-1', 'paidUpShareCapital') ? { value: 'yes', why: 'Client Details gives a paid-up equity capital.' } : null),
  },
  {
    stepId: 'pre-13',
    fieldId: 'equityNominalValue',
    derive: (state) => {
      const nominal = amount(valueAt(state, 'pre-1', 'nominalValuePerEquityShare'));
      return nominal ? { value: String(nominal), why: 'The nominal value per equity share in Client Details.' } : { value: '10', why: 'INR 10 is the usual face value of one equity share; please confirm.' };
    },
  },
  {
    stepId: 'pre-13',
    fieldId: 'equityQuantity',
    derive: (state) => {
      const paidUp = amount(valueAt(state, 'pre-1', 'paidUpShareCapital'));
      const nominal = amount(valueAt(state, 'pre-13', 'equityNominalValue')) ?? amount(valueAt(state, 'pre-1', 'nominalValuePerEquityShare'));
      if (!paidUp || !nominal || paidUp % nominal !== 0) return null;
      return { value: String(paidUp / nominal), why: 'The paid-up capital divided by the nominal value per share.' };
    },
  },
  {
    stepId: 'pre-13',
    fieldId: 'preferenceShares',
    derive: () => ({ value: 'no', why: 'No preference share capital was found in the documents; please confirm.' }),
  },
  {
    stepId: 'pre-14',
    fieldId: 'registeredOfficeState',
    derive: (state) => {
      const value = inferIndianState(valueAt(state, 'pre-14', 'registeredOfficeCompleteAddress'));
      return value ? { value, why: 'Taken from the registered office address.' } : null;
    },
  },
];

/** True when only the client can give this answer: a client step's field that is not the lead's. */
export function clientKnows(stepId: string, key: string): boolean {
  const item = getItem(stepId);
  if (!item || item.responsibleRole !== 'client') return false;
  const fieldId = key.split('.').at(-1)!;
  if (isLeadOnlyField(stepId, key) || isLeadOnlyField(stepId, fieldId)) return false;
  const [group, entryId, inner] = key.split('.');
  const field = inner && group && entryId ? fieldOf({ stepId, fieldId: inner, group, entryId }) : fieldOf({ stepId, fieldId: key });
  return field?.filledBy !== 'intern';
}

function kindOf(stepId: string, key: string): RequestItemKind {
  const [group, entryId, inner] = key.split('.');
  const field = inner && group && entryId ? fieldOf({ stepId, fieldId: inner, group, entryId }) : fieldOf({ stepId, fieldId: key });
  return field?.type === 'file' ? 'document' : 'answer';
}

/**
 * The ladder for every step asked for. A step already complete is passed over. Suggestions are laid
 * over the state as they are made, so a later step can use them ("number of shares" uses the
 * suggested nominal value).
 */
export function fillGaps(input: GapInput): GapField[] {
  let state = overlayState(input.state, input.cardValues);
  const out: GapField[] = [];
  for (const stepId of input.stepIds) {
    if (isDirectFlowStepComplete(stepId, input.state[stepId])) continue;
    const missing = stepMissingKeys({ stepId, state, engagement: input.engagement });
    if (missing.length === 0) continue;
    // Derivations first, then the validator again, until nothing new follows: a suggestion can open
    // a field ("equity shares: yes" opens the number of shares), which may follow in turn.
    const suggested: GapField[] = [];
    let still = missing;
    for (let round = 0; round < 4; round += 1) {
      let added = false;
      for (const rule of DERIVATIONS.filter((d) => d.stepId === stepId)) {
        const need = still.find((m) => m.key === rule.fieldId);
        if (!need || valueAt(state, stepId, rule.fieldId)) continue;
        const found = rule.derive(state);
        if (!found) continue;
        state = overlayState(state, { [stepId]: { [rule.fieldId]: found.value } });
        suggested.push({ stepId, key: rule.fieldId, label: need.label, rung: 'suggested', suggestion: { fieldId: rule.fieldId, ...found } });
        added = true;
      }
      if (!added) break;
      still = stepMissingKeys({ stepId, state, engagement: input.engagement });
    }
    out.push(...suggested);
    const labels = new Set<string>();
    for (const { key, label } of still) {
      if (suggested.some((s) => s.key === key)) continue;
      // One question per label: a list's empty entries share their field labels.
      if (labels.has(label)) continue;
      labels.add(label);
      if (clientKnows(stepId, key)) out.push({ stepId, key, label, rung: 'ask_client', kind: kindOf(stepId, key) });
      else out.push({ stepId, key, label, rung: 'left', reason: 'The project lead fills this on the step page.' });
    }
  }
  return out;
}

/** The request list items for the client, one per gap, named with the step. */
export function askClientItems(gaps: readonly GapField[]): Array<{ kind: RequestItemKind; label: string; help: string | null }> {
  return gaps
    .filter((g) => g.rung === 'ask_client')
    .map((g) => ({ kind: g.kind ?? 'answer', label: `${getItem(g.stepId)?.title ?? g.stepId}: ${g.label}`.slice(0, 300), help: null }));
}
