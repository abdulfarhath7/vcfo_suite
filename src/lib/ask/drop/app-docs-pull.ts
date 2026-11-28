import 'server-only';

import { createHash } from 'node:crypto';
import type { AuthContext } from '@/auth/guards';
import { createAskAttachment, listAskRunAttachments } from '@/db/repositories/ask-attachments';
import type { AskRunRow } from '@/db/repositories/ask-runs';
import { listAppDocumentFiles, type AppDocumentFile } from '@/db/repositories/client-documents';
import { listSeenSharepointFiles, recordSharepointFileCopied } from '@/db/repositories/sharepoint-files-seen';
import { DROP_MAX_FILES } from '@/lib/upload-limits';
import { getObjectBuffer } from '@/storage/s3';
import { dropContentType, dropFileRefusal, isZipName } from './extensions';
import type { DropFile, DropSharepointSource } from './types';
import { ZIP_ENTRY_MAX_BYTES } from './unzip';

/**
 * The documents already in the app, as a source of a fetch (PLAN M3). "Fill Bonterra into the app"
 * reads the project's own files beside its SharePoint folder: checklist uploads, the vault, the
 * finalised board resolution (docx and signed copy) and files sent against document requests,
 * exactly the files the person could open on the project's Documents page
 * (`listAppDocumentFiles`, scoped by the person's AuthContext).
 *
 * Each file joins the drop as an `ask_attachments` row of the run whose `s3_key` is the file's own
 * storage key, so nothing is copied, and with `relative_path` "In the app/<label>/<file>". The rows
 * are marked `origin: 'app'`, so the sorting step takes only their values and never files them a
 * second time.
 *
 * Reads are reused by content: a file is recorded in `sharepoint_files_seen` under the item id
 * `app:<ref>` with the sha256 of its bytes, and the read step reuses a stored read of the same bytes
 * on the same project, whether that read came from SharePoint, an upload of the same file or an
 * earlier fetch. A file whose ref and size are unchanged since its read is not downloaded at all.
 */

export const APP_FOLDER = 'In the app';
export const APP_COPY_LABEL = 'Gathering the documents in the app';
const APP_ITEM = 'app:';

export interface AppPullResult {
  /** The files added to the drop, to be read (or reused from a stored read). */
  files: DropFile[];
  /** Files reused from a stored read without a download. */
  reused: number;
  note?: string;
}

const versionOf = (doc: AppDocumentFile) => `${doc.key}|${doc.sizeBytes ?? ''}`;
const pathOf = (doc: AppDocumentFile) => `${APP_FOLDER}/${doc.label.replace(/[\\/]+/g, '-').trim() || 'Document'}/${doc.fileName}`;

export async function pullAppDocuments(
  ctx: AuthContext,
  run: Pick<AskRunRow, 'id' | 'conversationId'>,
  source: Pick<DropSharepointSource, 'engagementId'>,
  opts: { room?: number } = {},
): Promise<AppPullResult> {
  const docs = (await listAppDocumentFiles(ctx, source.engagementId)).filter((doc) => !dropFileRefusal(doc.fileName) && !isZipName(doc.fileName));
  if (docs.length === 0) return { files: [], reused: 0 };
  const seen = await listSeenSharepointFiles(ctx, source.engagementId);
  // A retry does not add a file twice.
  const done = new Set((await listAskRunAttachments(ctx, run.id)).map((r) => r.relativePath));
  let room = opts.room ?? DROP_MAX_FILES;
  let reused = 0;
  let left = 0;
  const files: DropFile[] = [];

  for (const doc of docs) {
    const relativePath = pathOf(doc);
    if (done.has(relativePath)) continue;
    const itemId = `${APP_ITEM}${doc.ref}`;
    const before = seen.get(itemId);
    const unchanged = Boolean(before?.readKey && before.cTag === versionOf(doc));
    // A file read before costs nothing, so it never takes one of the drop's places.
    if (!unchanged && room <= 0) {
      left += 1;
      continue;
    }
    let sha256 = before?.sha256 ?? '';
    let size = doc.sizeBytes ?? 0;
    if (!unchanged) {
      const bytes = await getObjectBuffer(doc.key).catch(() => null);
      if (!bytes || bytes.length > ZIP_ENTRY_MAX_BYTES) continue;
      sha256 = createHash('sha256').update(bytes).digest('hex');
      size = bytes.length;
      room -= 1;
    } else reused += 1;
    const attachment = await createAskAttachment(ctx, {
      kind: 'file',
      fileName: doc.fileName,
      contentType: dropContentType(doc.fileName),
      sizeBytes: size,
      s3Key: doc.key,
      conversationId: run.conversationId,
      runId: run.id,
      relativePath,
    });
    await recordSharepointFileCopied(ctx, source.engagementId, { itemId, cTag: versionOf(doc), sha256, path: relativePath, attachmentId: attachment.id });
    files.push({ attachmentId: attachment.id, path: relativePath, size, status: 'queued', origin: 'app' });
  }
  const note = left > 0 ? `${left} more document${left === 1 ? '' : 's'} in the app ${left === 1 ? 'was' : 'were'} left for the next fetch, because this fetch has no room for more new files.` : undefined;
  return { files, reused, ...(note ? { note } : {}) };
}
