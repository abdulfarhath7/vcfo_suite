import 'server-only';

import { z } from 'zod';
import { getActiveCatalogItems } from '@/data/checklist';
import { submitClientChangeRequest } from '@/lib/client-portal/change-request';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import type { ChangesetRecipient } from '@/lib/ask/changeset/types';
import { jsonTarget, loadEngagement, oneRow, recheckOf, stepTitle, unavailable } from '../shared';
import { defineAction, type ActionContext, type AnyAction } from '../types';

/**
 * BR-07: the client asks for a change through Ask VCFO ("request a change in clause 3 of the board
 * resolution"). The card shows the request text and the step; nothing goes until the client
 * confirms it. It then makes exactly the record the "Request a change" pop-up makes
 * (`submitClientChangeRequest`), so the lead gets the same task and notification.
 */
const input = z.object({
  engagementId: z.string().min(1),
  /** The checklist step the change is about, for example `pre-2` for the draft board resolution. */
  stepId: z.string().min(1),
  /** The client's own words: what should change. */
  note: z.string().trim().min(2).max(2000),
});
type Input = z.infer<typeof input>;

/** The project leads who receive the request, named on the confirmation card. */
async function leadRecipients(engagementDbId: string): Promise<ChangesetRecipient[]> {
  const found = await resolveEngagementRecipients(engagementDbId);
  const leads = found ? (found.leads.length > 0 ? found.leads : found.lead ? [found.lead] : []) : [];
  return leads.map((p) => ({ name: p.name || 'Your project lead', role: 'Project lead' }));
}

async function check(actx: ActionContext, value: Input) {
  const loaded = await loadEngagement(actx.auth, value.engagementId);
  if (!loaded) return unavailable();
  return recheckOf(
    [
      { rule: 'scope', ok: true },
      getActiveCatalogItems().some((i) => i.id === value.stepId)
        ? { rule: 'step', ok: true }
        : { rule: 'step', ok: false, message: 'That step is not on the checklist.' },
    ],
    { oldValue: '', value: value.note, displayOld: '', displayNew: `“${value.note}”` },
  );
}

const requestChange = defineAction({
  name: 'client-portal.requestChange',
  description:
    'The client asks their project lead to change something on one checklist step (for example a clause of the draft board resolution). Records a change request for the lead; the client confirms the text first.',
  capability: 'Ask your project lead to change something on a step',
  input,
  tier: 'T3',
  roles: ['client'],
  common: true,
  async preview(actx, value) {
    const loaded = await loadEngagement(actx.auth, value.engagementId);
    const { note: _note, ...target } = value;
    return oneRow({
      title: `Change request to your project lead · ${stepTitle(value.stepId)}`,
      tier: 'T3',
      engagementId: value.engagementId,
      action: 'client-portal.requestChange',
      target: jsonTarget(target),
      label: `Request a change · ${stepTitle(value.stepId)}`,
      checked: await check(actx, value),
      recipients: loaded ? await leadRecipients(loaded.row.id) : [],
    });
  },
  recheck: (actx, value) => check(actx, value),
  async execute(actx, value) {
    const out = await submitClientChangeRequest(actx.auth, { ...value, via: 'chat' });
    if (!out) return { ok: false, error: 'Project not found' };
    return { ok: true, summary: `Sent your request to your project lead: “${value.note}”`, href: `/app/client/incorporation/step/${value.stepId}` };
  },
});

export const actions: AnyAction[] = [requestChange as AnyAction];
