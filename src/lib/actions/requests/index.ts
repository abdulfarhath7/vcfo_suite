import 'server-only';

import { z } from 'zod';
import { setDocumentRequestDetails } from '@/db/repositories/client-documents';
import { listVaultRequests } from '@/db/repositories/documents';
import { createAndNotifyDocumentRequest } from '@/lib/requests/create-document-request';
import { itemKey } from '@/lib/work/item-key';
import { ActionRefused, clientRecipients, lockedClient, recordDraft, refusing, STAFF_ROLES } from '../shared';
import { defineAction, type ActionContext, type AnyAction } from '../types';

/** Document requests to the client, through the same function as the screen's request form. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function scoped(actx: ActionContext, requestId: string) {
  const request = (await listVaultRequests(actx.auth, lockedClient(actx))).find((r) => r.id === requestId);
  if (!request) throw new ActionRefused('That request is not on this project.');
  return request;
}

const list = defineAction({
  name: 'requests.list',
  label: 'Reading the document requests',
  description: 'List the document requests on this project with id, title, status, due date and the files sent against each. itemKey is what reminders.sendClient takes.',
  input: z.object({}),
  tier: 'T0',
  roles: STAFF_ROLES,
  common: true,
  preview: async () => null,
  execute: (actx) =>
    refusing(async () => {
      const requests = await listVaultRequests(actx.auth, lockedClient(actx));
      const lines = requests.slice(0, 40).map((r) => ({ id: r.id, title: r.title, status: r.status, dueOn: r.dueOn, files: r.files.length, itemKey: itemKey({ kind: 'request', id: r.id }) }));
      return { ok: true, summary: JSON.stringify({ total: requests.length, requests: lines }) };
    }),
});

const create = defineAction({
  name: 'requests.create',
  simple: true,
  description: 'Propose asking the client for a document. The client is emailed. A person confirms it on a card that lists who will be told.',
  input: z.object({ label: z.string().trim().min(1).max(200), message: z.string().trim().max(1000).optional(), dueOn: isoDate.optional() }),
  tier: 'T3',
  roles: STAFF_ROLES,
  common: true,
  examples: [{ label: 'Rent agreement for the registered office', message: 'A signed copy, please.', dueOn: '2026-12-01' }],
  preview: async (actx, input) =>
    recordDraft(actx, {
      action: 'requests.create',
      tier: 'T3',
      title: 'Ask the client for a document',
      label: 'Request',
      target: input,
      displayNew: `${input.label}${input.dueOn ? `, by ${input.dueOn}` : ''}${input.message ? `. ${input.message}` : ''}`,
      recipients: await clientRecipients(lockedClient(actx)),
    }),
  execute: (actx, input) =>
    refusing(async () => {
      const { request } = await createAndNotifyDocumentRequest(actx.auth, { engagementId: lockedClient(actx), label: input.label, message: input.message, dueAt: input.dueOn });
      return { ok: true, summary: `Asked the client for ${request.label}.` };
    }),
});

const setDetails = defineAction({
  name: 'requests.setDetails',
  description: 'Propose changing a document request\'s due date or review note. The client reads the review note in their portal. A person approves it on a card.',
  input: z.object({ requestId: z.string().uuid(), dueOn: isoDate.optional(), reviewNote: z.string().trim().max(1000).optional() }),
  tier: 'T2',
  roles: STAFF_ROLES,
  preview: async (actx, input) => {
    const request = await scoped(actx, input.requestId);
    return recordDraft(actx, {
      action: 'requests.setDetails',
      // The client reads the review note as the request's note, so a note is confirmed like a message.
      tier: input.reviewNote ? 'T3' : 'T2',
      title: 'Change a document request',
      label: request.title,
      target: input,
      displayOld: request.dueOn ? `Due ${request.dueOn}` : '',
      displayNew: [input.dueOn ? `Due ${input.dueOn}` : null, input.reviewNote ?? null].filter(Boolean).join('. '),
      ...(input.reviewNote ? { recipients: await clientRecipients(lockedClient(actx)) } : {}),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const request = await scoped(actx, input.requestId);
      const changed = await setDocumentRequestDetails(actx.auth, input.requestId, { dueOn: input.dueOn, reviewNote: input.reviewNote });
      return changed ? { ok: true, summary: `Updated ${request.title}.` } : { ok: false, error: 'That request is not available.' };
    }),
});

export const actions: AnyAction[] = [list, create, setDetails];
