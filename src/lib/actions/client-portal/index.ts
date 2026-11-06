import 'server-only';

import { z } from 'zod';
import { getItem, getActiveCatalogItems } from '@/data/checklist';
import { getOwnAskAttachments } from '@/db/repositories/ask-attachments';
import { addClientFilingProof, clearFilingReminder, complianceErrorStatus, getPortalFilings, setFilingReminder } from '@/db/repositories/client-compliances';
import { listOpenDocumentRequests, undoRequestUpload, UploadRejectedError } from '@/db/repositories/client-documents';
import { clientAttachRequestedFile, clientUndoRequestedFile, FileRequestError, listFileRequests } from '@/db/repositories/client-incorporation';
import { getSubjectInputs, saveSubjectFields } from '@/db/repositories/compliance-inputs';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import type { ChangesetRecipient } from '@/lib/ask/changeset/types';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { gateActiveCatalog, getStepGate } from '@/lib/checklist/checklist-step-gate';
import { requestClientStepChange } from '@/lib/client/request-step-change';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';
import { submitDirectStep } from '@/lib/incorporation/submit-direct-step';
import { sendClientMessage } from '@/lib/messages/send-client-message';
import { MESSAGE_BODY_MAX } from '@/lib/messages/types';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { answerDocumentRequest } from '@/lib/requests/answer-document-request';
import { itemKey } from '@/lib/work/item-key';
import { getObjectBuffer } from '@/storage/s3';
import { attachAnswerFile, setAnswer, storeChatFile } from '../checklist/set-response';
import { ActionRefused, assertOnLockedClient, lockedClient, recordDraft, refusing } from '../shared';
import { defineAction, type ActionContext, type AnyAction } from '../types';

/**
 * What a client can do from the chat, on their own company only. The company is the run's lock and is
 * never part of an input. The firm's work, sign-offs, logins and anything on another company are not
 * here, and every write below goes through the same function as the portal's screen.
 */

const CLIENT = ['client'] as const;
const NOTE_MAX = 2000;
const id = z.string().uuid();

/** The firm's people who hear about it, worked out by code and shown by name. */
async function firmPeople(engagementId: string, withManagers = false): Promise<ChangesetRecipient[]> {
  const parties = await resolveEngagementRecipients(engagementId);
  const leads = parties?.leads ?? [];
  const managers = withManagers || leads.length === 0 ? (parties?.managers ?? []) : [];
  return [...leads.map((p) => ({ name: p.name, role: 'Project lead' })), ...managers.map((p) => ({ name: p.name, role: 'Project manager' }))];
}

async function openRequest(actx: ActionContext, requestId: string) {
  const request = (await listOpenDocumentRequests(actx.auth, lockedClient(actx))).find((r) => r.id === requestId);
  if (!request) throw new ActionRefused('That request is not open on your company.');
  return request;
}

async function openFileRequest(actx: ActionContext, requestId: string) {
  const request = (await listFileRequests(actx.auth, lockedClient(actx))).find((r) => r.id === requestId && !r.fulfilledAt);
  if (!request) throw new ActionRefused('That request is not open on your company.');
  return request;
}

async function ownFiling(actx: ActionContext, filingId: string) {
  const [filing] = await getPortalFilings(actx.auth, { ids: [filingId] });
  if (!filing) throw new ActionRefused('That filing is not on your company.');
  assertOnLockedClient(actx, filing.engagementId, 'filing');
  return filing;
}

async function chatFiles(actx: ActionContext, attachmentIds: readonly string[]) {
  const rows = await getOwnAskAttachments(actx.auth, attachmentIds);
  if (rows.length !== new Set(attachmentIds).size) throw new ActionRefused('One of those files is no longer available. Please attach it again.');
  return rows;
}

async function chatFileBytes(attachment: { s3Key: string | null }) {
  const bytes = attachment.s3Key ? await getObjectBuffer(attachment.s3Key) : null;
  if (!bytes) throw new ActionRefused('That file is no longer available. Please attach it again.');
  return bytes;
}

async function ownDetails(actx: ActionContext, input: { kind: 'obligation' | 'registration'; key: string }) {
  const details = await getSubjectInputs(actx.auth, input);
  if (!details) throw new ActionRefused('Those details are not on your company.');
  assertOnLockedClient(actx, details.engagementId, 'record');
  return details;
}

/** A step the client fills and can still act on; the same answer the screen's gate gives. */
async function openStep(actx: ActionContext, stepId: string) {
  const item = getItem(stepId);
  if (!item) throw new ActionRefused('That step is not on your company file.');
  if (!isDirectFlowStep(stepId)) throw new ActionRefused('Your project lead handles this step. You can ask them for a change.');
  const row = await getEngagementById(actx.auth, engagementDbId(lockedClient(actx)));
  if (!row) throw new ActionRefused('Your company is not available.');
  const gate = getStepGate(gateActiveCatalog(checklistStateFromRow(row), 'client'), stepId);
  if (gate.kind === 'done') throw new ActionRefused('This step is already submitted. Ask for a change to edit it.');
  if (gate.kind !== 'active') throw new ActionRefused(gate.message ?? `"${item.title}" is not open yet.`);
  return item;
}

const overview = defineAction({
  name: 'client-portal.overview',
  label: 'Reading your company file',
  description: 'List what is open on your company: document requests with their id, files asked for on a step, and every step with its id, title, state and whether you fill it.',
  input: z.object({}),
  tier: 'T0',
  roles: CLIENT,
  common: true,
  preview: async () => null,
  execute: (actx) =>
    refusing(async () => {
      const engagementId = lockedClient(actx);
      const [requests, fileRequests, row] = await Promise.all([listOpenDocumentRequests(actx.auth, engagementId), listFileRequests(actx.auth, engagementId), getEngagementById(actx.auth, engagementDbId(engagementId))]);
      if (!row) return { ok: false, error: 'Your company is not available.' };
      const gates = gateActiveCatalog(checklistStateFromRow(row), 'client');
      const steps = getActiveCatalogItems().map((item) => ({ stepId: item.id, title: item.title, state: getStepGate(gates, item.id).kind, youFill: isDirectFlowStep(item.id) }));
      const asked = fileRequests.filter((r) => !r.fulfilledAt).map((r) => ({ id: r.id, label: r.label, stepId: r.stepId, dueDate: r.dueDate ?? null }));
      return { ok: true, summary: maskIdentityNumbers(JSON.stringify({ requests, filesAskedForOnSteps: asked, steps })) };
    }),
});

const listFilings = defineAction({
  name: 'client-portal.listFilings',
  label: 'Reading your filings',
  description: 'List your company\'s filings with id, name, period, due date and whether each is filed.',
  input: z.object({}),
  tier: 'T0',
  roles: CLIENT,
  common: true,
  preview: async () => null,
  execute: (actx) =>
    refusing(async () => {
      const filings = (await getPortalFilings(actx.auth)).filter((f) => engagementDbId(f.engagementId) === engagementDbId(lockedClient(actx)));
      const lines = filings.slice(0, 60).map((f) => ({ id: f.id, name: f.name, period: f.period, dueDate: f.dueDate, filedOn: f.filedOn }));
      return { ok: true, summary: JSON.stringify({ total: filings.length, filings: lines }) };
    }),
});

const details = z.object({ kind: z.enum(['obligation', 'registration']), key: z.string().trim().min(1).max(120) });

const readDetails = defineAction({
  name: 'client-portal.readDetails',
  label: 'Reading the details asked for',
  description: 'Read the details you give for one filing (kind obligation, key its filing id) or registration (kind registration, key its step id): each field\'s key, label and current value.',
  input: details,
  tier: 'T0',
  roles: CLIENT,
  preview: async () => null,
  execute: (actx, input) =>
    refusing(async () => {
      const found = await ownDetails(actx, input);
      const fields = found.client.map((f) => ({ key: f.key, label: f.label, value: f.value }));
      return { ok: true, summary: maskIdentityNumbers(JSON.stringify({ fields, submittedAt: found.submittedAt, confirmedAt: found.confirmedAt })) };
    }),
});

const saveDetails = defineAction({
  name: 'client-portal.saveDetails',
  description: 'Propose saving the details you give for one filing or registration, by field key. Your project lead sees them and confirms them. You approve it on a card.',
  input: details.extend({ values: z.record(z.string().max(60), z.string().max(500)) }),
  tier: 'T2',
  roles: CLIENT,
  preview: async (actx, input) => {
    const found = await ownDetails(actx, input);
    const fields = found.client.filter((f) => f.key in input.values);
    if (fields.length === 0 || fields.length !== Object.keys(input.values).length) throw new ActionRefused('The firm fills some of those details, or they are not asked for here.');
    return recordDraft(actx, {
      action: 'client-portal.saveDetails',
      tier: 'T2',
      title: 'Save your details',
      label: 'Your details',
      target: input,
      displayOld: maskIdentityNumbers(fields.filter((f) => f.value).map((f) => `${f.label}: ${f.value}`).join('. ')),
      displayNew: fields.map((f) => `${f.label}: ${input.values[f.key]}`).join('. '),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const found = await ownDetails(actx, input);
      const previous = Object.fromEntries(found.client.filter((f) => f.key in input.values).map((f) => [f.key, f.value]));
      const saved = await saveSubjectFields(actx.auth, { kind: input.kind, key: input.key, side: 'client', values: input.values });
      if (!saved) return { ok: false, error: 'The firm fills those details, or they are not asked for here.' };
      return { ok: true, summary: 'Saved your details.', undo: { kind: input.kind, key: input.key, previous } };
    }),
  undo: (actx, raw) =>
    refusing(async () => {
      const undo = details.extend({ previous: z.record(z.string(), z.string().nullable()) }).parse(raw);
      await ownDetails(actx, undo);
      await saveSubjectFields(actx.auth, { kind: undo.kind, key: undo.key, side: 'client', values: undo.previous });
      return { ok: true, summary: 'Put your details back.' };
    }),
});

export const uploadToRequest = defineAction({
  name: 'client-portal.uploadToRequest',
  routerOnly: true,
  description: 'Send files from the chat against one open document request. Your project lead is told. You confirm it on a card.',
  input: z.object({ requestId: id, attachmentIds: z.array(id).min(1).max(5) }),
  tier: 'T3',
  roles: CLIENT,
  preview: async (actx, input) => {
    const [request, files] = await Promise.all([openRequest(actx, input.requestId), chatFiles(actx, input.attachmentIds)]);
    return recordDraft(actx, {
      action: 'client-portal.uploadToRequest',
      tier: 'T3',
      title: 'Send a document to the firm',
      label: request.title,
      target: input,
      displayNew: files.map((f) => f.fileName).join(', '),
      recipients: await firmPeople(lockedClient(actx)),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      await openRequest(actx, input.requestId);
      const rows = await chatFiles(actx, input.attachmentIds);
      const files = await Promise.all(rows.map(async (f) => ({ name: f.fileName, type: f.contentType ?? '', size: f.sizeBytes ?? 0, bytes: await chatFileBytes(f) })));
      try {
        const answered = await answerDocumentRequest(actx.auth, input.requestId, files);
        if (!answered) return { ok: false, error: 'That request is not open on your company.' };
        const { out } = answered;
        if (out.fileIds.length === 0) return { ok: false, error: out.rejected[0]?.error ?? 'This file could not be sent.' };
        const refused = out.rejected.length > 0 ? ` Not sent: ${out.rejected.map((r) => r.error).join('; ')}.` : '';
        return { ok: true, summary: `Sent ${out.fileIds.length} file${out.fileIds.length === 1 ? '' : 's'} for ${out.requestLabel}.${refused}`, undo: { requestId: input.requestId, fileId: out.fileIds[0]! } };
      } catch (error) {
        if (error instanceof UploadRejectedError) return { ok: false, error: error.message };
        throw error;
      }
    }),
  undo: async (actx, raw) => {
    const { requestId, fileId } = raw as { requestId: string; fileId: string };
    return (await undoRequestUpload(actx.auth, requestId, fileId)) ? { ok: true, summary: 'Took the files back.' } : { ok: false, error: 'This can only be taken back in the first ten minutes.' };
  },
});

export const attachRequestedFile = defineAction({
  name: 'client-portal.attachRequestedFile',
  routerOnly: true,
  description: 'Put a file from the chat on the step where the firm asked for it. You approve it on a card.',
  input: z.object({ requestId: id, attachmentId: id }),
  tier: 'T2',
  roles: CLIENT,
  preview: async (actx, input) => {
    const [request, [file]] = await Promise.all([openFileRequest(actx, input.requestId), chatFiles(actx, [input.attachmentId])]);
    return recordDraft(actx, {
      action: 'client-portal.attachRequestedFile',
      tier: 'T2',
      title: 'Add a file the firm asked for',
      label: request.label,
      target: input,
      displayNew: file!.fileName,
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const engagementId = lockedClient(actx);
      const request = await openFileRequest(actx, input.requestId);
      const stored = await storeChatFile(actx, input.attachmentId, engagementDbId(engagementId), request.fieldId, request.stepId, true);
      try {
        await clientAttachRequestedFile(actx.auth, engagementId, request.stepId, { requestId: request.id, ...stored, sizeBytes: stored.sizeBytes ?? undefined, contentType: stored.contentType ?? undefined });
      } catch (error) {
        if (error instanceof FileRequestError) return { ok: false, error: 'This request is no longer open.' };
        throw error;
      }
      return { ok: true, summary: `Added ${stored.fileName} for ${request.label}.`, undo: { stepId: request.stepId, requestId: request.id } };
    }),
  undo: (actx, raw) =>
    refusing(async () => {
      const { stepId, requestId } = raw as { stepId: string; requestId: string };
      await clientUndoRequestedFile(actx.auth, lockedClient(actx), stepId, requestId);
      return { ok: true, summary: 'Took the file back. The request is open again.' };
    }),
});

export const addFilingProof = defineAction({
  name: 'client-portal.addFilingProof',
  routerOnly: true,
  description: 'Send a file from the chat as your proof on one of your filings. Your project lead is told and decides whether it is filed. You confirm it on a card.',
  input: z.object({ filingId: id, attachmentId: id, kind: z.enum(['acknowledgement', 'challan', 'other']) }),
  tier: 'T3',
  roles: CLIENT,
  preview: async (actx, input) => {
    const [filing, [file]] = await Promise.all([ownFiling(actx, input.filingId), chatFiles(actx, [input.attachmentId])]);
    return recordDraft(actx, {
      action: 'client-portal.addFilingProof',
      tier: 'T3',
      title: 'Send proof on a filing',
      label: `${filing.name} · ${filing.period}`,
      target: input,
      displayNew: file!.fileName,
      recipients: await firmPeople(lockedClient(actx)),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const filing = await ownFiling(actx, input.filingId);
      const [file] = await chatFiles(actx, [input.attachmentId]);
      try {
        await addClientFilingProof(actx.auth, filing.id, { name: file!.fileName, type: file!.contentType ?? '', bytes: new Uint8Array(await chatFileBytes(file!)) }, input.kind);
      } catch (error) {
        if (complianceErrorStatus(error) !== null) return { ok: false, error: (error as Error).message };
        throw error;
      }
      return { ok: true, summary: `Sent ${file!.fileName} for ${filing.name}.` };
    }),
});

const remindFiling = defineAction({
  name: 'client-portal.remindFiling',
  label: 'Setting your reminder',
  description: 'Set your own reminder for one of your filings. Only you are reminded, and it can be turned off.',
  input: z.object({ filingId: id }),
  tier: 'T1',
  roles: CLIENT,
  preview: async () => null,
  execute: (actx, input) =>
    refusing(async () => {
      const filing = await ownFiling(actx, input.filingId);
      if (filing.filedOn) return { ok: false, error: 'This filing is already filed.' };
      const { remindOn } = await setFilingReminder(actx.auth, filing.id);
      return { ok: true, summary: `You will be reminded about ${filing.name} on ${remindOn}.`, undo: { filingId: filing.id } };
    }),
  undo: (actx, raw) =>
    refusing(async () => {
      await clearFilingReminder(actx.auth, (raw as { filingId: string }).filingId);
      return { ok: true, summary: 'Your reminder is off.' };
    }),
});

const sendMessage = defineAction({
  name: 'client-portal.sendMessage',
  simple: true,
  description: 'Propose sending a message to the firm\'s people on your company. You confirm it on a card that lists who gets it.',
  input: z.object({ body: z.string().trim().min(1).max(MESSAGE_BODY_MAX) }),
  tier: 'T3',
  roles: CLIENT,
  common: true,
  preview: async (actx, input) =>
    recordDraft(actx, {
      action: 'client-portal.sendMessage',
      tier: 'T3',
      title: 'Send a message to the firm',
      label: 'Message',
      target: input,
      displayNew: input.body,
      recipients: await firmPeople(lockedClient(actx)),
    }),
  execute: (actx, input) =>
    refusing(async () => {
      const sent = await sendClientMessage(actx.auth, { engagementId: lockedClient(actx), body: input.body });
      return sent ? { ok: true, summary: 'Your message is sent.' } : { ok: false, error: 'Your company is not available.' };
    }),
});

const replyToRequest = defineAction({
  name: 'client-portal.replyToRequest',
  description: 'Propose replying to one open document request in words, for example to say when the file will come. Take the id from client-portal.overview. You confirm it on a card that lists who gets it.',
  input: z.object({ requestId: id, body: z.string().trim().min(1).max(MESSAGE_BODY_MAX) }),
  tier: 'T3',
  roles: CLIENT,
  preview: async (actx, input) => {
    const request = await openRequest(actx, input.requestId);
    return recordDraft(actx, {
      action: 'client-portal.replyToRequest',
      tier: 'T3',
      title: 'Reply to a document request',
      label: request.title,
      target: input,
      displayNew: input.body,
      recipients: await firmPeople(lockedClient(actx)),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const request = await openRequest(actx, input.requestId);
      const sent = await sendClientMessage(actx.auth, { engagementId: lockedClient(actx), body: input.body, itemKey: itemKey({ kind: 'request', id: input.requestId }) });
      return sent ? { ok: true, summary: `Your reply on ${request.title} is sent.` } : { ok: false, error: 'Your company is not available.' };
    }),
});

const requestStepChange = defineAction({
  name: 'client-portal.requestStepChange',
  description: 'Propose asking the firm to change something on a step. A submitted step that is with you reopens, and the steps after it lock again. Take the step id from client-portal.overview. You confirm it on a card.',
  input: z.object({ stepId: z.string().trim().min(1).max(40), note: z.string().trim().min(1).max(NOTE_MAX) }),
  tier: 'T3',
  roles: CLIENT,
  preview: async (actx, input) => {
    const item = getItem(input.stepId);
    if (!item) throw new ActionRefused('That step is not on your company file.');
    return recordDraft(actx, {
      action: 'client-portal.requestStepChange',
      tier: 'T3',
      title: 'Ask for a change',
      label: item.title,
      target: input,
      displayNew: input.note,
      recipients: await firmPeople(lockedClient(actx), true),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      if (!getItem(input.stepId)) return { ok: false, error: 'That step is not on your company file.' };
      const outcome = await requestClientStepChange(actx.auth, { engagementId: lockedClient(actx), stepId: input.stepId, note: input.note });
      return outcome ? { ok: true, summary: `Your request on ${outcome.request.stepTitle} is sent.` } : { ok: false, error: 'Your company is not available.' };
    }),
});

const SUBMIT_REFUSALS: Record<string, string> = {
  step_already_submitted: 'This step is already submitted. Ask for a change to edit it.',
  step_waiting_on_lead: 'Your project lead is finishing this step.',
};

const submitStep = defineAction({
  name: 'client-portal.submitStep',
  description: 'Propose submitting a step you fill, once its answers are in. Everyone on your company hears, and after that it takes a change request to edit it. Take the step id from client-portal.overview. You confirm it on a card.',
  input: z.object({ stepId: z.string().trim().min(1).max(40) }),
  tier: 'T3',
  roles: CLIENT,
  preview: async (actx, input) => {
    const item = await openStep(actx, input.stepId);
    return recordDraft(actx, {
      action: 'client-portal.submitStep',
      tier: 'T3',
      title: 'Submit a step',
      label: item.title,
      target: input,
      displayNew: 'Submitted to the firm',
      recipients: await firmPeople(lockedClient(actx), true),
    });
  },
  execute: (actx, input) =>
    refusing(async () => {
      const item = await openStep(actx, input.stepId);
      try {
        const result = await submitDirectStep(actx.auth, lockedClient(actx), input.stepId, {});
        if (result.outcome === 'invalid') return { ok: false, error: maskIdentityNumbers(`Some answers on this step need work first: ${Object.values(result.fieldErrors).slice(0, 3).join(' ')}`) };
        return { ok: true, summary: result.outcome === 'waiting_on_lead' ? `${item.title} is with your project lead to finish.` : `${item.title} is submitted.` };
      } catch (error) {
        const refusal = error instanceof Error ? SUBMIT_REFUSALS[error.message] : undefined;
        if (refusal) return { ok: false, error: refusal };
        throw error;
      }
    }),
});

export const actions: AnyAction[] = [overview, listFilings, readDetails, saveDetails, setAnswer, attachAnswerFile, uploadToRequest, attachRequestedFile, addFilingProof, remindFiling, sendMessage, replyToRequest, requestStepChange, submitStep];

