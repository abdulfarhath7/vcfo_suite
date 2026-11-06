import 'server-only';

import { z } from 'zod';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import { getFilings } from '@/db/repositories/filings';
import { FilingStatusError, markFilingFiled, reopenFiling } from '@/db/repositories/filing-status';
import { filingStatus } from '@/lib/compliance/filings';
import { buildPhaseProgress, currentPhaseRow } from '@/lib/ask/phase-progress';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { ActionRefused, lockedClient, recordDraft, refusing, STAFF_ROLES } from '../shared';
import { defineAction, type ActionContext, type AnyAction } from '../types';

/** Where a project stands, and the filing register, through the screen's repository calls. */

async function scopedFiling(actx: ActionContext, filingId: string) {
  const { rows } = await getFilings(actx.auth, { engagementId: lockedClient(actx) });
  const filing = rows.find((row) => row.id === filingId);
  if (!filing) throw new ActionRefused('That filing is not on this project.');
  return filing;
}

const projectOverview = defineAction({
  name: 'statuses.projectOverview',
  label: 'Checking where the project stands',
  description: 'Where this project stands: current step, what it is waiting on, and progress by phase.',
  input: z.object({}),
  tier: 'T0',
  roles: STAFF_ROLES,
  common: true,
  preview: async () => null,
  execute: (actx) =>
    refusing(async () => {
      const row = await getEngagementById(actx.auth, engagementDbId(lockedClient(actx)));
      if (!row) return { ok: false, error: 'That project is not available.' };
      const phases = buildPhaseProgress({ state: checklistStateFromRow(row) });
      return { ok: true, summary: JSON.stringify({ company: row.companyName, stage: row.stage, current: currentPhaseRow(phases), phases }) };
    }),
});

const listFilings = defineAction({
  name: 'statuses.listFilings',
  label: 'Reading the filings',
  description: 'List this project\'s compliance filings with id, form, due date, filed date and status. Open ones come first.',
  input: z.object({}),
  tier: 'T0',
  roles: STAFF_ROLES,
  preview: async () => null,
  execute: (actx) =>
    refusing(async () => {
      const { rows } = await getFilings(actx.auth, { engagementId: lockedClient(actx) });
      const lines = rows
        .map((r) => ({ id: r.id, form: r.particular, area: r.compliance, period: r.periodLabel, dueDate: r.dueDate, filedOn: r.filedOn, status: filingStatus(r, actx.now) }))
        .sort((a, b) => Number(Boolean(a.filedOn)) - Number(Boolean(b.filedOn)) || a.dueDate.localeCompare(b.dueDate));
      return { ok: true, summary: JSON.stringify({ total: rows.length, filings: lines.slice(0, 40) }) };
    }),
});

const markFiled = defineAction({
  name: 'statuses.markFiled',
  description: 'Propose recording that a filing has been filed, with the date. This records what already happened on the portal and never files anything. A person approves it on a card.',
  input: z.object({ filingId: z.string().uuid(), filedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().trim().max(500).optional() }),
  tier: 'T2',
  roles: STAFF_ROLES,
  common: true,
  preview: async (actx, input) => {
    const filing = await scopedFiling(actx, input.filingId);
    return recordDraft(actx, {
      action: 'statuses.markFiled',
      tier: 'T2',
      title: 'Record a filing as filed',
      label: `${filing.particular}${filing.periodLabel ? `, ${filing.periodLabel}` : ''}`,
      target: input,
      displayOld: filing.filedOn ? `Filed ${filing.filedOn}` : 'Not filed',
      displayNew: `Filed ${input.filedOn ?? actx.now.toISOString().slice(0, 10)}${input.note ? `. ${input.note}` : ''}`,
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const filing = await scopedFiling(actx, input.filingId);
      await markFilingFiled(actx.auth, input.filingId, { filedOn: input.filedOn, note: input.note });
      return { ok: true, summary: `${filing.particular} is recorded as filed.`, undo: { filingId: input.filingId } };
    }),
  undo: async (actx, undo) => {
    const id = (undo as { filingId?: unknown } | null)?.filingId;
    if (typeof id !== 'string') return { ok: false, error: 'This cannot be undone.' };
    try {
      await reopenFiling(actx.auth, id);
      return { ok: true, summary: 'The filing is open again.' };
    } catch (error) {
      if (error instanceof FilingStatusError) return { ok: false, error: error.message };
      throw error;
    }
  },
});

export const actions: AnyAction[] = [projectOverview, listFilings, markFiled];
