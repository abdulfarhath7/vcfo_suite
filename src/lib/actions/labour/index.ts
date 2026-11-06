import 'server-only';

import { z } from 'zod';
import { stateByCode } from '@/data/labour-registers/states';
import { getEngagementById } from '@/db/repositories/engagements';
import { getBatch, listBatches, markReady, openBatch, reopenInputs, updateBatch, type BatchRow } from '@/db/repositories/labour-registers';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { loadBatchView } from '@/views/labour-registers/load-batch';
import { ActionRefused, assertOnLockedClient, lockedClient, recordDraft, refusing, STAFF_ROLES } from '../shared';
import { defineAction, type ActionContext, type ActionResult, type AnyAction } from '../types';
import { assumptionsInput, mergeAssumptions } from './flows';

/**
 * Labour registers on the locked client: the monthly close and the build, with the same rules as the
 * batch screen. Closing a period is a person's statement that the data is accurate, so it runs only
 * from that person's click on a card that says so. The readiness it stores comes from code.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const batchRef = z.object({ batchId: z.string().uuid() });

/** The repository's own sentences, in the words a person reads in the chat. */
const REFUSALS: ReadonlyArray<readonly [string, string]> = [
  ['already marked ready', 'This period is already closed. Reopen the inputs to change them.'],
  ['not permitted', 'You cannot do this on this register batch.'],
  ['a reason is required', 'This needs a reason.'],
];

async function said<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const copy = error instanceof Error ? REFUSALS.find(([start]) => error.message.startsWith(start)) : undefined;
    if (copy) throw new ActionRefused(copy[1]);
    throw error;
  }
}
const run = (work: () => Promise<ActionResult>) => refusing(() => said(work));

async function scoped(actx: ActionContext, batchId: string): Promise<BatchRow> {
  const batch = await getBatch(actx.auth, batchId);
  if (!batch) throw new ActionRefused('That register batch is not available.');
  assertOnLockedClient(actx, batch.engagementId, 'register batch');
  return batch;
}

const periodOf = (batch: Pick<BatchRow, 'stateCode' | 'periodFrom' | 'periodTo'>) => `${stateByCode(batch.stateCode)?.name ?? batch.stateCode}, ${batch.periodFrom} to ${batch.periodTo}`;

const list = defineAction({
  name: 'labour.listBatches',
  label: 'Reading the labour registers',
  description: 'List this project\'s labour register batches, one per state and period, newest first, with id, status and whether the period is closed. Use an id from here for any other labour action.',
  input: z.object({}),
  tier: 'T0',
  roles: STAFF_ROLES,
  preview: async () => null,
  execute: (actx) =>
    run(async () => {
      const batches = await listBatches(actx.auth, { engagementId: lockedClient(actx) });
      const lines = batches.slice(0, 40).map((b) => ({ id: b.id, state: stateByCode(b.stateCode)?.name ?? b.stateCode, from: b.periodFrom, to: b.periodTo, status: b.status, closed: Boolean(b.markedReadyAt), reopened: b.reopenCount }));
      return { ok: true, summary: JSON.stringify({ total: batches.length, batches: lines }) };
    }),
});

const status = defineAction({
  name: 'labour.batchStatus',
  label: 'Checking the register batch',
  description: 'Read where one batch stands: which uploads are in, what the readiness check says is complete, short or blocking, and which registers exist. The same check as the batch screen.',
  input: batchRef,
  tier: 'T0',
  roles: STAFF_ROLES,
  preview: async () => null,
  execute: (actx, input) =>
    run(async () => {
      await scoped(actx, input.batchId);
      const view = await loadBatchView(actx.auth, input.batchId);
      if (!view) return { ok: false, error: 'That register batch is not available.' };
      const uploads = Object.entries(view.uploads).map(([slot, upload]) => ({ slot, fileName: upload?.fileName, rows: upload?.rowCount }));
      const { canClose, lines, employees, registers, acts } = view.readiness;
      return { ok: true, summary: JSON.stringify({ status: view.status, closed: view.locked, period: view.period, uploads, attendanceAssumed: view.attendanceAssumed, sphere: view.sphere, readiness: { canClose, lines: lines.map((l) => ({ kind: l.kind, text: l.text })), employees, registers, acts }, documents: view.documents.map((d) => ({ formId: d.formId, format: d.format, status: d.status, attestedOn: d.attestedAt })) }) };
    }),
});

/** The state named, or the one state this project already keeps registers for. */
async function stateCodeFor(actx: ActionContext, named: string | undefined): Promise<string> {
  if (named) return named;
  const states = new Set((await listBatches(actx.auth, { engagementId: lockedClient(actx) })).map((batch) => batch.stateCode));
  if (states.size === 1) return [...states][0]!;
  throw new ActionRefused('Which state are these registers for? Say it with the two-letter code, such as TG for Telangana.');
}

const open = defineAction({
  name: 'labour.openBatch',
  simple: true,
  description: 'Propose opening the register batch for one state and period on this project, or finding the one that already exists. stateCode is the two-letter state code, TG for Telangana or KA for Karnataka; leave it out when the message names no state, and the code checks it. A person approves it on a card.',
  input: z.object({ stateCode: z.string().trim().min(2).max(3).optional(), periodFrom: isoDate, periodTo: isoDate }),
  tier: 'T2',
  roles: STAFF_ROLES,
  examples: [{ stateCode: 'TG', periodFrom: '2026-10-01', periodTo: '2026-10-31' }],
  preview: async (actx, input) => {
    const stateCode = await stateCodeFor(actx, input.stateCode);
    if (!stateByCode(stateCode)) throw new ActionRefused('That state code is not one the registers know. Use the two-letter code, such as TG.');
    if (input.periodFrom > input.periodTo) throw new ActionRefused('The period ends before it starts.');
    return recordDraft(actx, { action: 'labour.openBatch', tier: 'T2', title: 'Open a register batch', label: 'Labour registers', target: { ...input, stateCode }, displayNew: periodOf({ stateCode, periodFrom: input.periodFrom, periodTo: input.periodTo }) });
  },
  execute: (actx, input) =>
    run(async () => {
      const batch = await openBatch(actx.auth, { engagementId: lockedClient(actx), ...input, stateCode: await stateCodeFor(actx, input.stateCode) });
      if (!batch) return { ok: false, error: 'That project is not available.' };
      return { ok: true, summary: `The batch for ${periodOf(batch)} is open.` };
    }),
});

const LABELS: Record<string, string> = {
  fullAttendanceAssumed: 'Month fully present',
  weekOff: 'Weekly off',
  holidayList: 'Holiday list',
  dateOrder: 'Date order in the uploads',
  doubleRateOvertime: 'Overtime at double rate',
  wageRateBasis: 'Rate of wages per',
  dailyHours: 'Hours in a day',
  sphere: 'Rules the establishment is under',
};

/** One line per value: these change what the registers print, so the card spells each one out. */
function assumptionLines(values: z.infer<typeof assumptionsInput>): string {
  const { establishment, ...rest } = values;
  const lines = [...Object.entries(rest).map(([key, value]) => `${LABELS[key] ?? key}: ${value === true ? 'yes' : value === false ? 'no' : value}`), ...Object.entries(establishment ?? {}).map(([key, value]) => `Establishment ${key}: ${value}`)];
  return lines.join('. ');
}

const setAssumptions = defineAction({
  name: 'labour.setAssumptions',
  description: 'Propose setting the assumptions on an open labour register batch, which is how a figure was arrived at: month fully present, weekly off, overtime rate, wage basis, state or central rules, the establishment\'s shift times and wage payment date. These change what the registers print, and they stay with the batch as its basis. A person approves it on a card.',
  input: batchRef.extend({ assumptions: assumptionsInput }),
  tier: 'T2',
  roles: STAFF_ROLES,
  preview: async (actx, input) => {
    const batch = await scoped(actx, input.batchId);
    if (batch.markedReadyAt) throw new ActionRefused('The period is closed. Reopen the inputs to change how a figure was arrived at.');
    const displayNew = assumptionLines(input.assumptions);
    if (!displayNew) throw new ActionRefused('There is nothing to record on this batch.');
    return recordDraft(actx, { action: 'labour.setAssumptions', tier: 'T2', title: 'Record how figures were arrived at', label: periodOf(batch), target: input, displayNew });
  },
  execute: (actx, input) =>
    run(async () => {
      await scoped(actx, input.batchId);
      const outcome = await mergeAssumptions(actx.auth, input.batchId, input.assumptions);
      if (outcome.kind === 'not_found') return { ok: false, error: 'That register batch is not available.' };
      if (outcome.kind === 'closed') return { ok: false, error: 'The period is closed. Reopen the inputs to change how a figure was arrived at.' };
      return { ok: true, summary: 'The basis is recorded on the batch.', undo: JSON.parse(JSON.stringify({ batchId: input.batchId, previous: outcome.previous })) };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { batchId, previous } = (undo ?? {}) as { batchId: string; previous: Record<string, unknown> };
      const batch = await scoped(actx, batchId);
      if (batch.markedReadyAt) return { ok: false, error: 'The period is closed now, so this stays.' };
      await updateBatch(actx.auth, batchId, { assumptions: previous });
      return { ok: true, summary: 'The basis is back as it was.' };
    }),
});

async function readinessOf(actx: ActionContext, batchId: string) {
  const view = await loadBatchView(actx.auth, batchId);
  if (!view) throw new ActionRefused('That register batch is not available.');
  if (!view.readiness.canClose) {
    throw new ActionRefused(`This period cannot close yet: ${view.readiness.lines.filter((l) => l.kind === 'blocked').map((l) => l.text).join(' ')}`);
  }
  return view;
}

const close = defineAction({
  name: 'labour.markReady',
  description: 'Propose closing a labour register period, the monthly close of an open batch. The uploads and mapping lock, and the registers are built from exactly that. It is refused while the readiness check shows something blocking. Accepting the card is the person\'s own statement that the data is accurate, which no model can make for them.',
  input: batchRef,
  tier: 'T3',
  roles: STAFF_ROLES,
  preview: (actx, input) =>
    said(async () => {
      const batch = await scoped(actx, input.batchId);
      if (batch.markedReadyAt) throw new ActionRefused(REFUSALS[0]![1]);
      const view = await readinessOf(actx, input.batchId);
      const short = view.readiness.lines.filter((l) => l.kind === 'short').map((l) => l.text);
      return recordDraft(actx, { action: 'labour.markReady', tier: 'T3', title: 'Close the period', label: periodOf(batch), target: input, displayOld: `Open, ${view.readiness.employees} employees`, displayNew: `I confirm the employee, attendance and wage data for this period is accurate. ${view.sentence}${short.length ? ` Still short: ${short.join(' ')}` : ''}`, recipients: [] });
    }),
  execute: (actx, input) =>
    run(async () => {
      const batch = await scoped(actx, input.batchId);
      const view = await readinessOf(actx, input.batchId);
      const closed = await markReady(actx.auth, { batchId: input.batchId, accuracyConfirmed: true, readiness: view.readiness as unknown as Record<string, unknown> });
      if (!closed) return { ok: false, error: 'That register batch is not available.' };
      return { ok: true, summary: `The period ${periodOf(batch)} is closed, with your confirmation on record.`, undo: { batchId: input.batchId } };
    }),
  undo: (actx, undo) =>
    run(async () => {
      const { batchId } = (undo ?? {}) as { batchId: string };
      await scoped(actx, batchId);
      await reopenInputs(actx.auth, { batchId, reason: 'Undone from an Ask VCFO card.' });
      return { ok: true, summary: 'The period is open again, and the reopening is counted on the batch.' };
    }),
});

const reopen = defineAction({
  name: 'labour.reopen',
  description: 'Propose reopening a closed labour register period, with the reason, which stays on the batch and is counted. Registers already built stay as they are. A person approves it on a card.',
  input: batchRef.extend({ reason: z.string().trim().min(3).max(500) }),
  tier: 'T2',
  roles: STAFF_ROLES,
  preview: async (actx, input) => {
    const batch = await scoped(actx, input.batchId);
    if (!batch.markedReadyAt) throw new ActionRefused('This period is already open.');
    return recordDraft(actx, { action: 'labour.reopen', tier: 'T2', title: 'Reopen the period', label: periodOf(batch), target: input, displayOld: 'Closed', displayNew: `Open again: ${input.reason}` });
  },
  execute: (actx, input) =>
    run(async () => {
      const batch = await scoped(actx, input.batchId);
      await reopenInputs(actx.auth, input);
      return { ok: true, summary: `The period ${periodOf(batch)} is open again.` };
    }),
});

const generate = defineAction({
  name: 'labour.generate',
  description: 'Propose generating a closed period\'s labour registers, as Excel workbooks unless PDF is asked for too. Anything already built under the same inputs comes from storage. A form that cannot be built is reported, not fatal. This builds drafts and signs nothing. A person approves it on a card.',
  input: batchRef.extend({ formats: z.array(z.enum(['xlsx', 'pdf'])).min(1).max(2).optional() }),
  tier: 'T2',
  roles: STAFF_ROLES,
  preview: async (actx, input) => {
    const batch = await scoped(actx, input.batchId);
    if (!batch.markedReadyAt) throw new ActionRefused('Mark the inputs ready before generating. Nothing is built from a half-gathered month.');
    return recordDraft(actx, { action: 'labour.generate', tier: 'T2', title: 'Build the registers', label: periodOf(batch), target: input, displayNew: `Registers for this period, as ${(input.formats ?? ['xlsx']).join(' and ')}` });
  },
  execute: (actx, input) =>
    run(async () => {
      const batch = await scoped(actx, input.batchId);
      const engagement = await getEngagementById(actx.auth, engagementDbId(batch.engagementId));
      // Loaded here: the workbook and PDF renderers are heavy, and every chat request loads this file.
      const { generateRegisters } = await import('./generate');
      const outcome = await generateRegisters(actx.auth, { ...input, companyName: engagement?.companyName });
      if (outcome.kind === 'not_found') return { ok: false, error: 'That register batch is not available.' };
      if (outcome.kind === 'not_ready') return { ok: false, error: 'Mark the inputs ready before generating. Nothing is built from a half-gathered month.' };
      const built = outcome.documents.filter((d) => d.built).length;
      const notBuilt = [...outcome.blocked, ...outcome.deferred].map((f) => `${f.formId}: ${f.reason}`);
      return { ok: true, summary: `Built ${built} file${built === 1 ? '' : 's'}, and ${outcome.documents.length - built} came from storage.${notBuilt.length ? ` Not built: ${notBuilt.slice(0, 10).join(' ')}` : ''}` };
    }),
});

export const actions: AnyAction[] = [list, status, open, setAssumptions, close, reopen, generate];
