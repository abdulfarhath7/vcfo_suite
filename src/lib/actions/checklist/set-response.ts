import 'server-only';

import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import { getOwnAskAttachments } from '@/db/repositories/ask-attachments';
import { indexMilestoneUpload } from '@/db/repositories/documents';
import { MILESTONE_DOCUMENTS_BUCKET, milestoneDocumentObjectPath } from '@/lib/documents/milestone-document-storage';
import { applyChecklistPatch, ChecklistPatchRefused } from '@/lib/incorporation/apply-checklist-patch';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { isRepeatField, removeRepeatEntry, repeatEntries } from '@/lib/checklist/checklist-repeat';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import { checklistGateViewerFrom, gateActiveCatalog, getStepGate } from '@/lib/checklist/checklist-step-gate';
import { getItem } from '@/data/checklist';
import { MILESTONE_DOCUMENT_EXTENSIONS, resolveUploadExtension } from '@/lib/upload-limits';
import { bucketKey, getObjectBuffer, putObject } from '@/storage/s3';
import type { AppRole } from '@/auth/guards';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { ActionRefused, assertOnLockedClient, refusing } from '../shared';
import { defineAction, type ActionContext, type ActionRecheck, type ActionResult } from '../types';
import { checkResponseRow, displayValue, fieldOf, responseActionsFor, responseKey, rowCanApply, type ResponseTarget } from './rules';

/**
 * Filling one checklist field from an approved card. The write goes through `applyChecklistPatch`,
 * the same code as the screen's save, so audit and notifications run as usual. A lead never saves a
 * client-only answer here either, because that function strips it and the check below notices.
 */

const targetInput = z.object({
  engagementId: z.string().min(1),
  stepId: z.string().min(1),
  fieldId: z.string().min(1),
  group: z.string().min(1).optional(),
  entryId: z.string().min(1).optional(),
  newEntry: z.boolean().optional(),
  needsManager: z.boolean().optional(),
});
const setInput = targetInput.extend({ value: z.string() });
const attachInput = targetInput.extend({ attachmentId: z.string().uuid(), value: z.string() });

type UndoData = { engagementId: string; stepId: string; key: string; previous: string; applied: string; group?: string; entryId?: string; addedEntry?: boolean };

async function loadRow(auth: AuthContext, engagementId: string) {
  const row = await getEngagementById(auth, engagementDbId(engagementId));
  return row ? { row, state: checklistStateFromRow(row) } : null;
}

async function recheck(actx: ActionContext, input: ResponseTarget & { value: string }, pending: Readonly<Record<string, string>>, isFile: boolean): Promise<ActionRecheck> {
  const loaded = await loadRow(actx.auth, input.engagementId);
  if (!loaded) {
    return { checks: [{ rule: 'gate', ok: false, message: 'This project is not available.' }], heldReason: 'This project is not available.', canApply: false, oldValue: '', value: input.value, displayOld: '', displayNew: '', sensitive: false };
  }
  const result = checkResponseRow({ role: actx.auth.role, target: input, value: input.value, state: loaded.state, pending, engagement: loaded.row, isFile });
  const options = fieldOf(input)?.options;
  return {
    checks: result.checks,
    heldReason: result.heldReason,
    canApply: rowCanApply(result.checks),
    oldValue: result.oldValue,
    value: result.value,
    displayOld: isFile ? (result.oldValue ? 'A file is already attached' : '') : displayValue(result.oldValue, result.sensitive, options),
    displayNew: isFile ? input.value : displayValue(result.value, result.sensitive, options),
    sensitive: !isFile && result.sensitive,
  };
}

async function save(actx: ActionContext, input: ResponseTarget, value: string): Promise<ActionResult> {
  const loaded = await loadRow(actx.auth, input.engagementId);
  if (!loaded) return { ok: false, error: 'This project is not available.' };
  const saved = loaded.state[input.stepId]?.responses ?? {};
  const key = responseKey(input);
  const responses: Record<string, string> = { [key]: value };
  let addedEntry = false;
  if (input.group && input.entryId) {
    const ids = (saved[input.group] ?? '').split(',').filter(Boolean);
    if (!ids.includes(input.entryId)) {
      responses[input.group] = [...ids, input.entryId].join(',');
      addedEntry = true;
    }
  }
  try {
    const { checklistState } = await applyChecklistPatch(actx.auth, input.engagementId, input.stepId, { responses });
    if (checklistState[input.stepId]?.responses?.[key] !== value) return { ok: false, error: 'This person cannot fill this field.' };
  } catch (error) {
    if (error instanceof ChecklistPatchRefused) return { ok: false, error: error.message };
    throw error;
  }
  const undo: UndoData = {
    engagementId: input.engagementId,
    stepId: input.stepId,
    key,
    previous: saved[key] ?? '',
    applied: value,
    ...(input.group && input.entryId ? { group: input.group, entryId: input.entryId, addedEntry } : {}),
  };
  return { ok: true, summary: `Saved ${key}`, undo };
}

async function undoSave(actx: ActionContext, raw: JsonValue): Promise<ActionResult> {
  const undo = raw as unknown as UndoData;
  const loaded = await loadRow(actx.auth, undo.engagementId);
  if (!loaded) return { ok: false, error: 'This project is not available.' };
  const gate = getStepGate(gateActiveCatalog(loaded.state, checklistGateViewerFrom('admin', actx.auth.role)), undo.stepId);
  if (gate.kind === 'done') return { ok: false, error: 'This step is finished, so the value stays until it is reopened.' };
  const saved = loaded.state[undo.stepId]?.responses ?? {};
  if ((saved[undo.key] ?? '') !== undo.applied) return { ok: false, error: 'This value was changed after it was saved, so it was left as it is.' };
  let responses: Record<string, string> = { [undo.key]: undo.previous };
  if (undo.addedEntry && undo.group && undo.entryId) {
    const item = getItem(undo.stepId);
    const group = item ? getClientResponseFields(item).find((f) => f.id === undo.group) : undefined;
    if (group && isRepeatField(group)) {
      const merged = { ...saved, ...responses };
      const entry = repeatEntries(merged, group).find((e) => e.id === undo.entryId);
      if (entry && Object.values(entry.values).every((v) => !v?.trim())) responses = removeRepeatEntry(merged, group, undo.entryId);
    }
  }
  try {
    await applyChecklistPatch(actx.auth, undo.engagementId, undo.stepId, { responses });
  } catch (error) {
    if (error instanceof ChecklistPatchRefused) return { ok: false, error: error.message };
    throw error;
  }
  return { ok: true, summary: `Undid ${undo.key}` };
}

function previewOf(label: string, action: string, input: ResponseTarget & { value: string }, checked: ActionRecheck) {
  const { value: _value, ...target } = input;
  return {
    title: label,
    tier: 'T2' as const,
    engagementId: input.engagementId,
    rows: [
      {
        action,
        target: { ...target },
        label,
        oldValue: checked.oldValue,
        newValue: checked.value,
        displayOld: checked.displayOld,
        displayNew: checked.displayNew,
        sensitive: checked.sensitive,
        source: null,
        checks: checked.checks,
        ...(checked.heldReason ? { heldReason: checked.heldReason } : {}),
      },
    ],
  };
}

/**
 * The pair of actions for one audience: both run the same rules and the same save. A client's pair
 * also holds every row to the run's own company, and to the file types the screen's upload takes.
 */
function responseActions(input: { audience: 'staff' | 'client'; roles: readonly AppRole[]; description: { set: string; attach: string } }) {
  const names = responseActionsFor(input.audience === 'client' ? 'client' : 'staff');
  const client = input.audience === 'client';
  const onRun = (actx: ActionContext, target: ResponseTarget) => {
    if (client) assertOnLockedClient(actx, target.engagementId, 'step');
  };
  const set = defineAction({
    name: names.set,
    routerOnly: true,
    description: input.description.set,
    input: setInput,
    tier: 'T2',
    roles: input.roles,
    common: !client,
    async preview(actx, row) {
      onRun(actx, row);
      return previewOf(fieldOf(row)?.label ?? row.fieldId, names.set, row, await recheck(actx, row, {}, false));
    },
    recheck(actx, row, pending) {
      onRun(actx, row);
      return recheck(actx, row, pending, false);
    },
    async execute(actx, row) {
      const { value, ...target } = row;
      return refusing(async () => {
        onRun(actx, target);
        return save(actx, target, value);
      });
    },
    undo: undoSave,
  });
  const attach = defineAction({
    name: names.attach,
    routerOnly: true,
    description: input.description.attach,
    input: attachInput,
    tier: 'T2',
    roles: input.roles,
    async preview(actx, row) {
      onRun(actx, row);
      return previewOf(fieldOf(row)?.label ?? row.fieldId, names.attach, row, await recheck(actx, row, {}, true));
    },
    recheck(actx, row, pending) {
      onRun(actx, row);
      return recheck(actx, row, pending, true);
    },
    async execute(actx, row) {
      const { value: _value, ...target } = row;
      return refusing(async () => {
        onRun(actx, target);
        const key = responseKey(row);
        const stored = await storeChatFile(actx, row.attachmentId, row.engagementId, key, row.stepId, client);
        return save(actx, target, stored.path);
      });
    },
    undo: undoSave,
  });
  return { set, attach };
}

/** Copies a file from the chat to its place on a step, and lists it in the vault as the screen's upload does. */
export async function storeChatFile(actx: ActionContext, attachmentId: string, engagementId: string, key: string, stepId: string, checkType: boolean): Promise<{ path: string; fileName: string; sizeBytes: number | null; contentType: string | null }> {
  const [attachment] = await getOwnAskAttachments(actx.auth, [attachmentId]);
  const bytes = attachment?.s3Key ? await getObjectBuffer(attachment.s3Key) : null;
  if (!attachment || !bytes) throw new ActionRefused('The file is no longer available.');
  if (checkType && !resolveUploadExtension({ name: attachment.fileName, type: attachment.contentType ?? '' }, MILESTONE_DOCUMENT_EXTENSIONS)) {
    throw new ActionRefused('This file type cannot go on a step. Please send a PDF, an image or a Word file.');
  }
  const path = milestoneDocumentObjectPath(engagementId, key, attachment.fileName);
  await putObject(bucketKey(MILESTONE_DOCUMENTS_BUCKET, path), bytes, attachment.contentType ?? undefined);
  await indexMilestoneUpload(actx.auth, { engagementId, fieldId: key, fileName: attachment.fileName, objectKey: path, contentType: attachment.contentType, sizeBytes: attachment.sizeBytes, stepId });
  return { path, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes, contentType: attachment.contentType };
}

const staffActions = responseActions({
  audience: 'staff',
  roles: ['super_admin', 'admin', 'manager', 'intern'],
  description: {
    set: 'Fill one answer on an incorporation checklist step, after a person approves it on a review card.',
    attach: 'Attach a file from the chat to an upload field on an incorporation checklist step, after a person approves it.',
  },
});
export const setResponse = staffActions.set;
export const attachFile = staffActions.attach;

const clientActions = responseActions({
  audience: 'client',
  roles: ['client'],
  description: {
    set: 'Fill one of your own answers on a step of your company file, after you approve it on a review card.',
    attach: 'Attach a file from the chat to one of your own upload fields on a step, after you approve it.',
  },
});
export const setAnswer = clientActions.set;
export const attachAnswerFile = clientActions.attach;
