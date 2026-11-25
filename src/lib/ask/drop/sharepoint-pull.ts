import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { AuthContext } from '@/auth/guards';
import { createAskAttachment, listAskRunAttachments } from '@/db/repositories/ask-attachments';
import type { AskRunRow } from '@/db/repositories/ask-runs';
import { listSeenSharepointFiles, recordSharepointFileCopied } from '@/db/repositories/sharepoint-files-seen';
import { openClientsRoot, projectFolderLink, SharepointRefused } from '@/lib/sharepoint/client-folder';
import { walkFolder } from '@/lib/sharepoint/folder';
import { graphDownload, graphListChildren } from '@/lib/sharepoint/graph';
import { DROP_MAX_BYTES } from '@/lib/upload-limits';
import { putObject } from '@/storage/s3';
import { dropContentType, isZipName, safeFileName } from './extensions';
import type { DropFile, DropSharepointSource } from './types';
import { ZIP_ENTRY_MAX_BYTES } from './unzip';

/**
 * Copies one client's SharePoint folder into a drop. Each file becomes an `ask_attachments` row of
 * the run with its SharePoint path as `relative_path` (the client folder first), exactly as a
 * dropped folder does, so the drop's reader and sorter treat both the same. It reads as the person
 * who asked, with their own token, and only the folder linked to a project they can reach.
 *
 * A file that cannot be downloaded is left out with a reason rather than failing the drop; a refusal
 * for the whole folder (no token, no access) becomes a note for the closing message.
 *
 * A file an earlier fetch read and that did not change is not downloaded again, but it is not
 * forgotten either (PLAN M5): it joins the drop as a row with no bytes, marked `origin: 'stored'`,
 * and the read step takes its stored read, so the new card still carries its values.
 */

export const DOWNLOAD_FAILED = 'Left out: this file could not be downloaded from SharePoint.';
export const COPY_LABEL = 'Copying files from SharePoint';

/** Called before the first download and after each file, so the chat can show "12 of 50". */
export type PullProgress = (done: number, total: number) => Promise<void> | void;

export interface PullResult {
  copied: number;
  skipped: DropFile[];
  /** Files read in an earlier fetch, unchanged: their stored reads are used again. */
  stored?: DropFile[];
  note?: string;
}

export async function pullSharepointFiles(ctx: AuthContext, run: Pick<AskRunRow, 'id' | 'conversationId'>, source: DropSharepointSource, onProgress?: PullProgress): Promise<PullResult> {
  let link;
  let root;
  try {
    link = await projectFolderLink(ctx, source.engagementId);
    if (!link) return { copied: 0, skipped: [], note: 'This project is no longer linked to a SharePoint folder, so I fetched nothing.' };
    root = await openClientsRoot(ctx);
  } catch (error) {
    if (error instanceof SharepointRefused) return { copied: 0, skipped: [], note: error.message };
    throw error;
  }
  if (root.driveId !== link.driveId) return { copied: 0, skipped: [], note: 'The SharePoint site changed since this project was linked. Please link its folder again.' };

  const { access, driveId } = root;
  const folderName = link.folderName || source.folderName;
  // A file an earlier fetch read, unchanged, is left out, so asking again moves on to the next files.
  const seen = await listSeenSharepointFiles(ctx, source.engagementId);
  const isSeen = (item: { id: string; cTag?: string }) => {
    const before = seen.get(item.id);
    return Boolean(before?.readKey && item.cTag && before.cTag === item.cTag);
  };
  const walked = await walkFolder((itemId) => graphListChildren(access, driveId, itemId), link.folderId, undefined, isSeen);
  const seenNote = walked.alreadySeen > 0
    ? `${walked.alreadySeen} file${walked.alreadySeen === 1 ? ' was' : 's were'} read in an earlier fetch and did not change, so I used what I read then.`
    : undefined;
  const skipped: DropFile[] = walked.skipped.map((s) => ({
    attachmentId: `sharepoint:${s.itemId}`,
    path: `${folderName}/${s.path}`,
    size: s.size,
    status: 'skipped',
    reason: s.reason,
  }));
  const done = new Set((await listAskRunAttachments(ctx, run.id)).map((r) => r.relativePath));
  // The files read before: a row each, with no bytes, whose read step reuses the stored read.
  const stored: DropFile[] = [];
  for (const file of walked.seen) {
    const relativePath = `${folderName}/${file.path}`;
    const before = seen.get(file.itemId);
    if (done.has(relativePath) || !before) continue;
    const fileName = safeFileName(file.name);
    const attachment = await createAskAttachment(ctx, {
      kind: 'file',
      fileName,
      contentType: dropContentType(fileName),
      sizeBytes: file.size,
      s3Key: null,
      conversationId: run.conversationId,
      runId: run.id,
      relativePath,
    });
    if (!attachment?.id) continue;
    // The same bytes keep their stored read on the row (`recordSharepointFileCopied`).
    await recordSharepointFileCopied(ctx, source.engagementId, { itemId: file.itemId, cTag: file.cTag, sha256: before.sha256, path: relativePath, attachmentId: attachment.id });
    stored.push({ attachmentId: attachment.id, path: relativePath, size: file.size, status: 'queued', origin: 'stored' });
  }
  if (walked.files.length === 0 && walked.skipped.length === 0) {
    return { copied: 0, skipped, stored, note: seenNote ? `Nothing new in the SharePoint folder ${folderName}: ${seenNote}` : `The SharePoint folder ${folderName} has no files in it.` };
  }

  let copied = 0;
  const total = walked.files.length;
  // A retry starts at the files an earlier try already copied.
  let handled = walked.files.filter((f) => done.has(`${folderName}/${f.path}`)).length;
  await onProgress?.(handled, total);
  for (const file of walked.files) {
    const relativePath = `${folderName}/${file.path}`;
    if (done.has(relativePath)) continue;
    let bytes: Buffer;
    try {
      bytes = await graphDownload(access, driveId, file.itemId, isZipName(file.name) ? DROP_MAX_BYTES : ZIP_ENTRY_MAX_BYTES);
    } catch (error) {
      console.error('[sharepoint] download failed', error instanceof Error ? error.message.slice(0, 200) : error);
      skipped.push({ attachmentId: `sharepoint:${file.itemId}`, path: relativePath, size: file.size, status: 'failed', reason: DOWNLOAD_FAILED });
      handled += 1;
      await onProgress?.(handled, total);
      continue;
    }
    const fileName = safeFileName(file.name);
    const contentType = dropContentType(fileName);
    const s3Key = `ask/attachments/${ctx.userId}/${randomUUID()}/${fileName}`;
    await putObject(s3Key, bytes, contentType);
    const attachment = await createAskAttachment(ctx, {
      kind: 'file',
      fileName,
      contentType,
      sizeBytes: bytes.length,
      s3Key,
      conversationId: run.conversationId,
      runId: run.id,
      relativePath,
    });
    if (attachment?.id) {
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      await recordSharepointFileCopied(ctx, source.engagementId, { itemId: file.itemId, cTag: file.cTag, sha256, path: relativePath, attachmentId: attachment.id });
    }
    copied += 1;
    handled += 1;
    await onProgress?.(handled, total);
  }
  return { copied, skipped, stored, ...(seenNote ? { note: seenNote } : {}) };
}
