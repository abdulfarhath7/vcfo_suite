import 'server-only';

import { z } from 'zod';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getSubjectInputs, InputsForbiddenError, saveSubjectFields } from '@/db/repositories/compliance-inputs';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { rowCanApply } from '../checklist/rules';
import { loadEngagement, STAFF_ROLES, unavailable } from '../shared';
import { defineAction, type ActionContext, type ActionRecheck, type ActionResult } from '../types';
import { checkSubjectFieldRow, subjectFieldLabel, type SubjectFieldTarget } from './field-rules';

/**
 * Fills one field of a registration step (`compliance_subject_fields`) from an approved Ask VCFO
 * card: a GST REG-01 value no checklist step holds (district, reason, premises, SAC codes), or the
 * GST copy of a value whose checklist step is finished (the principal place's state, a director's
 * address). It is the same `saveSubjectFields` the "From the client" and "Filled by SBC" cards
 * call, as the person who clicked, so its scope and tracker rules apply; a staff save of a
 * client-side field is not a client submit. The write is audited and can be undone while the
 * value is unchanged.
 */

const input = z.object({
  engagementId: z.string().min(1),
  kind: z.literal('registration'),
  key: z.string().regex(/^reg-\d{1,3}$/),
  side: z.enum(['client', 'sbc']),
  fieldKey: z.string().min(1).max(60),
  catalogKey: z.string().max(120).optional(),
  homeStep: z.string().max(20).optional(),
  homeField: z.string().max(200).optional(),
  value: z.string().max(2000),
});
type Input = z.infer<typeof input>;

interface UndoData {
  target: Omit<SubjectFieldTarget, 'catalogKey' | 'homeStep' | 'homeField'>;
  previous: string;
  applied: string;
}

const targetOf = (i: Input): SubjectFieldTarget => {
  const { value: _value, ...target } = i;
  return target;
};

async function savedValue(actx: ActionContext, t: Pick<SubjectFieldTarget, 'engagementId' | 'kind' | 'key' | 'side' | 'fieldKey'>): Promise<string | null> {
  const inputs = await getSubjectInputs(actx.auth, { engagementId: t.engagementId, kind: t.kind, key: t.key });
  if (!inputs) return null;
  return (t.side === 'client' ? inputs.client : inputs.sbc).find((f) => f.key === t.fieldKey)?.value ?? '';
}

async function check(actx: ActionContext, i: Input): Promise<ActionRecheck> {
  const target = targetOf(i);
  const old = await savedValue(actx, target);
  if (old === null) return unavailable();
  let homeValue: string | undefined;
  if (target.homeStep && target.homeField) {
    const loaded = await loadEngagement(actx.auth, target.engagementId);
    homeValue = loaded?.state[target.homeStep]?.responses?.[target.homeField] ?? undefined;
  }
  const checked = checkSubjectFieldRow({ role: actx.auth.role, target, value: i.value, oldValue: old, homeValue });
  return {
    checks: checked.checks,
    heldReason: checked.heldReason,
    canApply: rowCanApply(checked.checks),
    oldValue: checked.oldValue,
    value: checked.value,
    displayOld: checked.oldValue,
    displayNew: checked.value,
    sensitive: false,
  };
}

async function write(actx: ActionContext, t: UndoData['target'], value: string): Promise<boolean> {
  return saveSubjectFields(actx.auth, { engagementId: t.engagementId, kind: t.kind, key: t.key, side: t.side, values: { [t.fieldKey]: value || null } });
}

async function execute(actx: ActionContext, i: Input): Promise<ActionResult> {
  const { catalogKey: _c, homeStep: _s, homeField: _f, ...target } = targetOf(i);
  const previous = await savedValue(actx, target);
  if (previous === null) return { ok: false, error: 'This project is not available.' };
  const checked = checkSubjectFieldRow({ role: actx.auth.role, target: targetOf(i), value: i.value, oldValue: previous });
  if (!rowCanApply(checked.checks)) return { ok: false, error: checked.heldReason ?? checked.checks.find((c) => !c.ok)?.message ?? 'A check failed.' };
  try {
    if (!(await write(actx, target, checked.value))) return { ok: false, error: 'This field is not on the registration.' };
  } catch (error) {
    if (error instanceof InputsForbiddenError) return { ok: false, error: error.message };
    throw error;
  }
  const label = subjectFieldLabel(target);
  await recordAuditEvent(actx.auth, {
    engagementId: target.engagementId,
    action: 'registration.field.saved',
    summary: `Saved ${label} from an Ask VCFO card`,
    metadata: { via: actx.via, runId: actx.runId, kind: target.kind, key: target.key, side: target.side, field: target.fieldKey },
    result: 'ok',
  });
  const undo: UndoData = { target, previous, applied: checked.value };
  return { ok: true, summary: `Saved ${label}`, undo: undo as unknown as JsonValue };
}

/** Puts back the value the card replaced, unless someone changed the field since. */
async function undo(actx: ActionContext, raw: JsonValue): Promise<ActionResult> {
  const data = raw as unknown as UndoData;
  const now = await savedValue(actx, data.target);
  if (now === null) return { ok: false, error: 'This project is not available.' };
  if (now !== data.applied) return { ok: false, error: 'This value was changed after it was saved, so it was left as it is.' };
  try {
    if (!(await write(actx, data.target, data.previous))) return { ok: false, error: 'This field is not on the registration.' };
  } catch (error) {
    if (error instanceof InputsForbiddenError) return { ok: false, error: error.message };
    throw error;
  }
  await recordAuditEvent(actx.auth, {
    engagementId: data.target.engagementId,
    action: 'registration.field.undone',
    summary: `Undid ${subjectFieldLabel(data.target)} saved from an Ask VCFO card`,
    metadata: { via: actx.via, kind: data.target.kind, key: data.target.key, side: data.target.side, field: data.target.fieldKey },
    result: 'ok',
  });
  return { ok: true, summary: `Undid ${data.target.fieldKey}` };
}

export const setField = defineAction({
  name: 'registrations.setField',
  description:
    'Fill one field of a registration step (for GST REG-01: district, reason, premises, activities, HSN or SAC codes, or the GST copy of a value on a finished checklist step), after a person approves it on a review card.',
  capability: 'Fill GST registration details from text you paste or papers you drop (you review a card before anything saves)',
  input,
  tier: 'T2',
  roles: STAFF_ROLES,
  async preview(actx, i) {
    const checked = await check(actx, i);
    const { value: _value, ...target } = i;
    return {
      title: 'Registration details',
      tier: 'T2',
      engagementId: i.engagementId,
      rows: [
        {
          action: 'registrations.setField',
          target: { ...target },
          label: subjectFieldLabel(target),
          oldValue: checked.oldValue,
          newValue: checked.value,
          displayOld: checked.displayOld,
          displayNew: checked.displayNew,
          sensitive: false,
          source: null,
          checks: checked.checks,
          ...(checked.heldReason ? { heldReason: checked.heldReason } : {}),
        },
      ],
    };
  },
  recheck: (actx, i) => check(actx, i),
  execute,
  undo,
});
