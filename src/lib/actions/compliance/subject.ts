import 'server-only';

import { z } from 'zod';
import type { BeforeFilingLine } from '@/data/before-filing';
import { listChecklistTicks, setChecklistTick, type ChecklistTick } from '@/db/repositories/compliance-checklist-checks';
import {
  askSubjectDocument,
  confirmSubjectFields,
  getSubjectInputs,
  reviewSubjectDocument,
  saveSubjectFields,
  type InputsKind,
  type SubjectInputsDto,
} from '@/db/repositories/compliance-inputs';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { ActionRefused, CHANGED_SINCE, clientRecipients, lockedClient, MASKED_VALUE, recordDraft, refusing, STAFF_ROLES, stillAsSaved } from '../shared';
import { defineAction, type ActionContext, type ActionResult, type AnyAction } from '../types';

/**
 * What a filing period and a registration share: the client's and SBC's fields, the documents asked
 * for, and the "Before filing" ticks. One definition serves both areas, through the same repositories
 * the record screens call. A value the masking has already hidden is refused, so a masked number can
 * never be saved over the real one.
 */
export interface Subject {
  key: string;
  title: string;
  lines: readonly BeforeFilingLine[];
  /** A filed period's details stay as they were filed. */
  locked: boolean;
}

export interface SubjectArea {
  prefix: 'compliance' | 'registrations';
  kind: InputsKind;
  noun: string;
  /** Where the model finds the id, for the action descriptions. */
  idHelp: string;
  itemId: z.ZodType<string>;
  resolve(actx: ActionContext, itemId: string): Promise<Subject>;
}

/** The repositories' short codes and plain errors that a person can act on. */
const COPY: Record<string, string> = {
  forbidden: 'You cannot do this on this item.',
  filed: 'This filing is already filed.',
  'Already filed': 'This filing is already filed.',
  invalid_stage: 'That stage cannot be set here.',
  invalid_days: 'That number of days is out of range.',
  invalid_step: 'That registration is not available.',
  invalid_window: 'The window ends before it starts.',
  invalid_no_window: 'This filing has no working window to move. Ask the manager to set one.',
  invalid_same_window: 'That is already the working window.',
  invalid_reason: 'This needs a reason.',
  invalid_note: 'This needs a note saying why.',
  request_pending: 'You already have a date change waiting on this filing.',
  request_closed: 'That date change has already been decided.',
  'Filing not found': 'That filing is not available.',
  'Compliance instance not found': 'That filing is not available.',
  'Engagement not found or not permitted': 'That filing is not available.',
  'Only a project manager or admin may set date windows': 'Only a manager or admin can set a working window.',
  'Only SBC staff can change filings': 'Only firm staff can change a filing.',
};

export function refuseKnown(run: () => Promise<ActionResult>): Promise<ActionResult> {
  return refusing(async () => {
    try {
      return await run();
    } catch (error) {
      const text = error instanceof Error ? COPY[error.message] : undefined;
      if (text) throw new ActionRefused(text);
      throw error;
    }
  });
}

/** An undo payload has the shape of the action's own input, so it is parsed the same way. */
export function undoWith<Input>(schema: z.ZodType<Input>, run: (actx: ActionContext, input: Input) => Promise<ActionResult>) {
  return (actx: ActionContext, data: unknown): Promise<ActionResult> => {
    const parsed = schema.safeParse(data);
    return parsed.success ? refuseKnown(() => run(actx, parsed.data)) : Promise.resolve({ ok: false, error: 'This cannot be undone.' });
  };
}

async function readInputs(actx: ActionContext, area: SubjectArea, subject: Subject): Promise<SubjectInputsDto> {
  const inputs = await getSubjectInputs(actx.auth, { engagementId: lockedClient(actx), kind: area.kind, key: subject.key });
  if (!inputs) throw new ActionRefused(`That ${area.noun} is not available.`);
  return inputs;
}

/** The shape a record's read action hands the model: documents, fields and the checklist. */
export function subjectSummary(inputs: SubjectInputsDto | null, lines: readonly BeforeFilingLine[], ticks: readonly ChecklistTick[]) {
  const ticked = new Map(ticks.map((tick) => [tick.itemKey, tick]));
  return {
    documents: (inputs?.docs ?? []).map((d) => ({ requestId: d.id, label: d.label, status: d.status, note: d.note, dueOn: d.dueOn, files: d.files.map((f) => f.name) })),
    notAskedForYet: inputs?.needs ?? [],
    fromClient: inputs?.client.map((f) => ({ key: f.key, label: f.label, value: f.value })) ?? [],
    filledBySbc: inputs?.sbc.map((f) => ({ key: f.key, label: f.label, value: f.value })) ?? [],
    submittedAt: inputs?.submittedAt ?? null,
    confirmedAt: inputs?.confirmedAt ?? null,
    confirmedBy: inputs?.confirmedBy ?? null,
    beforeFiling: lines.map((line) => ({ line: line.key, label: line.label, done: ticked.has(line.key), by: ticked.get(line.key)?.checkedBy ?? null })),
  };
}

export async function readSubject(actx: ActionContext, area: SubjectArea, subject: Subject) {
  const [inputs, ticks] = await Promise.all([
    readInputs(actx, area, subject),
    listChecklistTicks(actx.auth, { engagementId: lockedClient(actx), subjectKind: area.kind, subjectKey: subject.key }),
  ]);
  return subjectSummary(inputs, subject.lines, ticks);
}

const shownValue = (value: string | null) => value ?? 'Empty';

export function subjectActions(area: SubjectArea): AnyAction[] {
  const { prefix, kind, noun, idHelp, itemId } = area;
  const nameOf = (verb: string) => `${prefix}.${verb}`;
  const engagementOf = (actx: ActionContext) => ({ engagementId: lockedClient(actx), kind });

  const fieldsInput = z.object({
    itemId,
    side: z.enum(['sbc', 'client']).optional(),
    fields: z.array(z.object({ key: z.string().trim().min(1).max(60), value: z.string().trim().max(500).nullable() })).min(1).max(20),
  });
  type FieldsInput = z.infer<typeof fieldsInput>;

  async function saveFields(actx: ActionContext, key: string, input: FieldsInput): Promise<void> {
    const saved = await saveSubjectFields(actx.auth, {
      ...engagementOf(actx),
      key,
      side: input.side ?? 'sbc',
      values: Object.fromEntries(input.fields.map((field) => [field.key, field.value])),
    });
    if (!saved) throw new ActionRefused(`Those fields could not be saved on this ${noun}.`);
  }

  async function planFields(actx: ActionContext, input: FieldsInput) {
    const subject = await area.resolve(actx, input.itemId);
    if (subject.locked) throw new ActionRefused('These details are locked after filing.');
    const inputs = await readInputs(actx, area, subject);
    const list = input.side === 'client' ? inputs.client : inputs.sbc;
    const known = new Map(list.map((field) => [field.key, field]));
    const unknown = input.fields.find((field) => !known.has(field.key));
    if (unknown) throw new ActionRefused(`"${unknown.key}" is not a field here. The fields are: ${list.map((field) => field.key).join(', ') || 'none'}.`);
    if (input.fields.some((field) => field.value && MASKED_VALUE.test(field.value))) {
      throw new ActionRefused('That number is masked here, so it cannot be saved from chat. Please type it on the record itself.');
    }
    const rows = input.fields.map((field) => ({ ...field, label: known.get(field.key)!.label, old: known.get(field.key)!.value }));
    return { subject, rows };
  }

  const saveFieldsAction = defineAction({
    name: nameOf('saveFields'),
    description: `Propose saving the details on a ${noun}: SBC's own fields, or with side "client" a correction to what the client gave. ${idHelp} Field keys come from the record's read. Identity numbers are masked in chat and cannot be saved from it. A person approves it on a card.`,
    input: fieldsInput,
    tier: 'T2',
    roles: STAFF_ROLES,
    preview: async (actx, input) => {
      const { subject, rows } = await planFields(actx, input);
      return recordDraft(actx, {
        action: nameOf('saveFields'),
        tier: 'T2',
        title: `Save the details on a ${noun}`,
        label: subject.title,
        target: input,
        displayOld: maskIdentityNumbers(rows.map((row) => `${row.label}: ${shownValue(row.old)}`).join(', ')),
        displayNew: rows.map((row) => `${row.label}: ${shownValue(row.value)}`).join(', '),
      });
    },
    execute: (actx, input) =>
      refuseKnown(async () => {
        const { subject, rows } = await planFields(actx, input);
        await saveFields(actx, subject.key, input);
        return {
          ok: true,
          summary: `Saved the details on ${subject.title}.`,
          undo: { itemId: input.itemId, side: input.side ?? 'sbc', fields: rows.map((row) => ({ key: row.key, value: row.old })), applied: Object.fromEntries(input.fields.map((field) => [field.key, field.value])) },
        };
      }),
    undo: undoWith(fieldsInput.extend({ applied: z.record(z.string(), z.string().nullable()) }), async (actx, { applied, ...input }) => {
      const subject = await area.resolve(actx, input.itemId);
      if (subject.locked) throw new ActionRefused('These details are locked after filing.');
      const inputs = await readInputs(actx, area, subject);
      const list = input.side === 'client' ? inputs.client : inputs.sbc;
      if (!stillAsSaved(Object.fromEntries(list.map((field) => [field.key, field.value])), applied)) return { ok: false, error: CHANGED_SINCE };
      await saveFields(actx, subject.key, input);
      return { ok: true, summary: 'Put the earlier details back.' };
    }),
  });

  const idOnly = z.object({ itemId });

  const confirmFields = defineAction({
    name: nameOf('confirmClientDetails'),
    description: `Propose confirming the details the client submitted on a ${noun}, which records who checked them. ${idHelp} A person approves it on a card.`,
    input: idOnly,
    tier: 'T2',
    roles: STAFF_ROLES,
    preview: async (actx, input) => {
      const subject = await area.resolve(actx, input.itemId);
      const inputs = await readInputs(actx, area, subject);
      if (!inputs.submittedAt) throw new ActionRefused('The client has not submitted these details yet.');
      return recordDraft(actx, {
        action: nameOf('confirmClientDetails'),
        tier: 'T2',
        title: `Confirm the client's details on a ${noun}`,
        label: subject.title,
        target: input,
        displayOld: inputs.confirmedAt ? `Confirmed by ${inputs.confirmedBy ?? 'staff'}` : 'Not confirmed',
        displayNew: `Confirmed: ${inputs.client.map((field) => `${field.label}: ${shownValue(field.value)}`).join(', ')}`,
      });
    },
    execute: (actx, input) =>
      refuseKnown(async () => {
        const subject = await area.resolve(actx, input.itemId);
        if (!(await confirmSubjectFields(actx.auth, { ...engagementOf(actx), key: subject.key }))) throw new ActionRefused(`That ${noun} is not available.`);
        return { ok: true, summary: `Confirmed the client's details on ${subject.title}.` };
      }),
  });

  const askInput = idOnly.extend({ label: z.string().trim().min(1).max(200), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

  const askDocument = defineAction({
    name: nameOf('askDocument'),
    description: `Propose asking the client for a document on a ${noun}. The request appears on the client's portal against this ${noun}. ${idHelp} A person confirms it on a card that names who sees it.`,
    input: askInput,
    tier: 'T3',
    roles: STAFF_ROLES,
    preview: async (actx, input) => {
      const subject = await area.resolve(actx, input.itemId);
      return recordDraft(actx, {
        action: nameOf('askDocument'),
        tier: 'T3',
        title: 'Ask the client for a document',
        label: subject.title,
        target: input,
        displayNew: `${input.label}${input.dueOn ? `, by ${input.dueOn}` : ''}`,
        recipients: await clientRecipients(lockedClient(actx)),
      });
    },
    execute: (actx, input) =>
      refuseKnown(async () => {
        const subject = await area.resolve(actx, input.itemId);
        const id = await askSubjectDocument(actx.auth, { ...engagementOf(actx), key: subject.key, label: input.label, dueOn: input.dueOn });
        if (!id) throw new ActionRefused(`That ${noun} is not available.`);
        return { ok: true, summary: `Asked the client for ${input.label}.` };
      }),
  });

  const reviewInput = idOnly.extend({ requestId: z.string().uuid(), decision: z.enum(['accept', 'send-back']), reason: z.string().trim().max(500).optional() });
  type ReviewInput = z.infer<typeof reviewInput>;

  async function planReview(actx: ActionContext, input: ReviewInput) {
    const subject = await area.resolve(actx, input.itemId);
    const doc = (await readInputs(actx, area, subject)).docs.find((d) => d.id === input.requestId);
    if (!doc) throw new ActionRefused(`That document is not on this ${noun}.`);
    if (doc.status !== 'To review') throw new ActionRefused('That document is not waiting for review.');
    if (input.decision === 'send-back' && !input.reason) throw new ActionRefused('This needs a reason for the client.');
    return { subject, doc };
  }

  const reviewDocument = defineAction({
    name: nameOf('reviewDocument'),
    description: `Propose accepting a document the client uploaded on a ${noun}, or sending it back with a reason the client reads. ${idHelp} A person confirms it on a card; this never accepts anything by itself.`,
    input: reviewInput,
    tier: 'T3',
    roles: STAFF_ROLES,
    preview: async (actx, input) => {
      const { subject, doc } = await planReview(actx, input);
      return recordDraft(actx, {
        action: nameOf('reviewDocument'),
        tier: 'T3',
        title: input.decision === 'accept' ? 'Accept a document' : 'Send a document back',
        label: `${subject.title}: ${doc.label}`,
        target: input,
        displayOld: doc.status,
        displayNew: input.decision === 'accept' ? 'Accepted' : `Sent back: ${input.reason}`,
        recipients: await clientRecipients(lockedClient(actx)),
      });
    },
    execute: (actx, input) =>
      refuseKnown(async () => {
        const { doc } = await planReview(actx, input);
        const done = await reviewSubjectDocument(actx.auth, { requestId: doc.id, action: input.decision, reason: input.reason ?? null });
        if (!done) throw new ActionRefused('That document is not waiting for review.');
        return { ok: true, summary: `${doc.label} is ${input.decision === 'accept' ? 'accepted' : 'sent back'}.` };
      }),
  });

  const tickInput = idOnly.extend({ lines: z.array(z.string().trim().min(1).max(120)).min(1).max(20), checked: z.boolean() });
  type TickInput = z.infer<typeof tickInput>;

  async function setTicks(actx: ActionContext, key: string, input: TickInput): Promise<void> {
    for (const line of input.lines) {
      const done = await setChecklistTick(actx.auth, { engagementId: lockedClient(actx), subjectKind: kind, subjectKey: key, itemKey: line, checked: input.checked });
      if (!done) throw new ActionRefused(`That ${noun} is not available.`);
    }
  }

  async function planTicks(actx: ActionContext, input: TickInput) {
    const subject = await area.resolve(actx, input.itemId);
    const labels = new Map(subject.lines.map((line) => [line.key, line.label]));
    const unknown = input.lines.find((line) => !labels.has(line));
    if (unknown) throw new ActionRefused(`"${unknown}" is not a line here. The lines are: ${[...labels.keys()].join(', ')}.`);
    const ticks = await listChecklistTicks(actx.auth, { engagementId: lockedClient(actx), subjectKind: kind, subjectKey: subject.key });
    const done = new Set(ticks.map((tick) => tick.itemKey));
    return { subject, labels, changing: input.lines.filter((line) => done.has(line) !== input.checked) };
  }

  const tickChecklist = defineAction({
    name: nameOf('tickChecklist'),
    description: `Propose ticking or unticking lines on the staff "Before filing" checklist of a ${noun}. ${idHelp} Line keys come from the record's read. A person approves it on a card.`,
    input: tickInput,
    tier: 'T2',
    roles: STAFF_ROLES,
    preview: async (actx, input) => {
      const { subject, labels } = await planTicks(actx, input);
      const lines = input.lines.map((line) => labels.get(line)).join(', ');
      return recordDraft(actx, {
        action: nameOf('tickChecklist'),
        tier: 'T2',
        title: `${input.checked ? 'Tick' : 'Untick'} the checklist on a ${noun}`,
        label: subject.title,
        target: input,
        displayNew: `${input.checked ? 'Done' : 'Not done'}: ${lines}`,
      });
    },
    execute: (actx, input) =>
      refuseKnown(async () => {
        const { subject, changing } = await planTicks(actx, input);
        await setTicks(actx, subject.key, { ...input, lines: changing });
        return { ok: true, summary: `Updated the checklist on ${subject.title}.`, undo: changing.length ? { itemId: input.itemId, lines: changing, checked: !input.checked } : undefined };
      }),
    undo: undoWith(tickInput, async (actx, input) => {
      const subject = await area.resolve(actx, input.itemId);
      await setTicks(actx, subject.key, input);
      return { ok: true, summary: 'Put the checklist back.' };
    }),
  });

  return [saveFieldsAction, confirmFields, askDocument, reviewDocument, tickChecklist];
}
