import 'server-only';

import { z } from 'zod';
import { scopedStatutory } from '@/db/repositories/compliance-statutory';
import { ingestAssistRun, listAssistRuns, requestAssistRun } from '@/db/repositories/assist-runs';
import { askFlags } from '@/lib/ask/config';
import { assistSetUp, assistWord, FINISHED } from '@/lib/assist-runs/runs';
import { rowOf } from '../registrations';
import { ActionRefused, assertOnLockedClient, lockedClient, recordDraft, refusing, STAFF_ROLES } from '../shared';
import { defineAction, type ActionContext } from '../types';

/**
 * "Prepare filing run": the agent's only step towards a government portal. It stores the same requested
 * run as the screen's "Start filing", after a person accepts the card. The extension fills the form,
 * and a person signs in, signs, pays, submits and records the reference there. The input is a kind and
 * an id, and code works out the form, so no login, OTP, DSC PIN or token has anywhere to travel.
 */

const input = z.object({
  kind: z.enum(['filing', 'registration']),
  itemId: z.string().regex(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|reg-\d{1,3})$/i),
});
type Input = z.infer<typeof input>;

const HAND_OFF = 'A requested run in VCFO Assist. You sign in, sign, pay, submit and record the reference there.';

/** Behind the owner's flag until the written CS opinion exists, and the Suite's own switch for the extension. */
const handoffOn = (): boolean => askFlags().assistHandoff && assistSetUp();

function assertHandoffOn(): void {
  if (!handoffOn()) throw new ActionRefused('Preparing a filing run is switched off for now.');
}

/** The same rules as the record screens' card: what is filed or not needed has no run, and the form comes from the record. */
async function subjectOf(actx: ActionContext, { kind, itemId }: Input): Promise<{ title: string; form: string | null }> {
  if (kind === 'registration') {
    const row = await rowOf(actx, itemId);
    if (row.word === 'Not needed' || row.word === 'Done') throw new ActionRefused(`${row.name} needs no filing run.`);
    return { title: row.name, form: row.form || row.item.forms[0] || null };
  }
  const { inst, obligation } = await scopedStatutory(actx.auth, itemId);
  assertOnLockedClient(actx, inst.engagementId, 'filing');
  if (inst.filedOn) throw new ActionRefused('This filing is already filed.');
  return { title: inst.periodLabel ? `${obligation.particular}, ${inst.periodLabel}` : obligation.particular, form: obligation.particular };
}

async function runsOf(actx: ActionContext, { kind, itemId }: Input) {
  const runs = await listAssistRuns(actx.auth, { engagementId: lockedClient(actx), subjectKind: kind, subjectKey: itemId });
  if (!runs) throw new ActionRefused('That is not on this project.');
  if (runs.some((run) => !FINISHED.has(run.state))) throw new ActionRefused('A VCFO Assist run is already open for this.');
  return runs;
}

export const prepareRun = defineAction({
  name: 'filing.prepareRun',
  description:
    'Propose preparing a filing run in VCFO Assist for one filing period or one registration, so the extension can fill the portal form. It files nothing: a person signs in, signs, pays, submits and records the reference there. Never ask for or pass a login, OTP, DSC PIN or token. kind is filing with a filing id from statuses.listFilings, or registration with a step id such as reg-4 from registrations.list. A person approves it on a card.',
  input,
  tier: 'T2',
  roles: STAFF_ROLES,
  available: handoffOn,
  preview: async (actx, value) => {
    assertHandoffOn();
    const subject = await subjectOf(actx, value);
    const runs = await runsOf(actx, value);
    return recordDraft(actx, {
      action: 'filing.prepareRun',
      tier: 'T2',
      title: 'Prepare a filing run',
      label: subject.title,
      target: value,
      displayOld: assistWord(runs[0]).label,
      displayNew: HAND_OFF,
    });
  },
  execute: (actx, value) =>
    refusing(async () => {
      assertHandoffOn();
      const subject = await subjectOf(actx, value);
      await runsOf(actx, value);
      const run = await requestAssistRun(actx.auth, { engagementId: lockedClient(actx), subjectKind: value.kind, subjectKey: value.itemId, form: subject.form });
      if (!run) return { ok: false, error: 'That is not on this project.' };
      return { ok: true, summary: `${subject.title}: the run is ready in VCFO Assist. You sign in, sign, pay and submit there.`, undo: { runId: run.id, kind: value.kind, itemId: value.itemId } };
    }),
  /** Only while it is still only a request: once the extension has picked it up, the run is the person's. */
  undo: (actx, undo) =>
    refusing(async () => {
      const { runId, kind, itemId } = undo as { runId: string; kind: Input['kind']; itemId: string };
      const runs = await listAssistRuns(actx.auth, { engagementId: lockedClient(actx), subjectKind: kind, subjectKey: itemId });
      if (runs?.find((run) => run.id === runId)?.state !== 'requested') return { ok: false, error: 'This run has already started, so it stays.' };
      await ingestAssistRun(actx.auth, lockedClient(actx), { runId, state: 'stopped' });
      return { ok: true, summary: 'The requested run is stopped.' };
    }),
});
