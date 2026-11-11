import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getActiveCatalogItems } from '@/data/checklist';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { getBoardResolutionByEngagementId } from '@/db/repositories/board-resolution';
import { getDocPackInputs } from '@/db/repositories/doc-pack';
import { renderDocPackItem } from '@/lib/api/doc-pack';
import { sanitizeBoardResolutionDocxBuffer } from '@/lib/board-resolution/board-resolution-docx';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { expandRepeatFields } from '@/lib/checklist/checklist-repeat';
import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import { MILESTONE_DOCUMENTS_BUCKET } from '@/lib/documents/milestone-document-storage';
import { tablesWorkbook } from '@/lib/exports/table-xlsx';
import { answersTable, entriesTable, groupOf, PROJECT_ZIP_FOLDERS as FOLDERS, type Responses } from '@/lib/projects/project-zip-tables';
import { standardDownloadName } from '@/lib/files/download-name';
import { createUniqueNamer, zipEntryPath } from '@/lib/zip/entry-names';
import { createZipStream, type ZipEntrySource } from '@/lib/zip/zip-writer';
import { downloadBoardResolutionDocx, downloadSignedBoardResolution } from '@/storage/board-resolution';
import { bucketKey, getObjectBuffer } from '@/storage/s3';

/**
 * PR-02: the whole project as one ZIP, one folder per kind of item:
 *
 *   1 Answers                 every step's questions and answers (xlsx)
 *   2 Directors               the proposed directors, one row each (xlsx)
 *   3 Subscribers             the subscribers to the memorandum, one row each (xlsx)
 *   4 Generated documents     every document the pack can make now
 *   5 Uploaded documents      every file uploaded on a step, by step
 *   6 Board resolution        the draft and the signed copy
 *   7 Audit log               the project's audit record (xlsx)
 *
 * Staff only (the repositories refuse a client). Made in the background by the caller.
 */

/** Every uploaded file on the steps: the step it belongs to and its storage path. */
function uploadedFiles(state: Record<string, { responses?: Responses } | undefined>): Array<{ step: string; path: string }> {
  const out: Array<{ step: string; path: string }> = [];
  for (const item of getActiveCatalogItems()) {
    const responses = state[item.id]?.responses ?? {};
    for (const field of expandRepeatFields(CLIENT_RESPONSE_FIELDS[item.id] ?? [], responses)) {
      const path = field.type === 'file' ? responses[field.id]?.trim() : '';
      if (path && !/^https?:/i.test(path)) out.push({ step: item.title, path });
    }
  }
  return out;
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

export async function buildProjectZip(
  ctx: AuthContext,
  engagementParam: string,
): Promise<{ bytes: Uint8Array; fileName: string; companyName: string; engagementId: string }> {
  const access = await getDocPackInputs(ctx, engagementParam);
  if (access.ok === false) throw new Error(access.error);
  const { inputs } = access;
  const { engagement, checklistState } = inputs;
  const state = checklistState as Record<string, { responses?: Responses } | undefined>;
  const company = engagement.companyName;
  const name = createUniqueNamer();
  const entries: ZipEntrySource[] = [];
  const add = (folder: string, fileName: string, open: ZipEntrySource['open']) =>
    entries.push({ name: name(zipEntryPath(folder, fileName)), open });

  add(FOLDERS.answers, standardDownloadName('Answers', company, 'xlsx'), async () => [await tablesWorkbook([answersTable(state)])]);
  add(FOLDERS.directors, standardDownloadName('Directors', company, 'xlsx'), async () => [
    await tablesWorkbook([entriesTable('Proposed directors', groupOf('pre-15', 'directors'), state['pre-15']?.responses ?? {})]),
  ]);
  add(FOLDERS.subscribers, standardDownloadName('Subscribers', company, 'xlsx'), async () => [
    await tablesWorkbook([entriesTable('Subscribers', groupOf('pre-16', 'subscribers'), state['pre-16']?.responses ?? {})]),
  ]);

  const summary = evaluateDocPack({ state: inputs.checklistState, brRow: inputs.brRow, engagement });
  for (const item of summary.items.filter((i) => i.status === 'ready' && i.generate.kind !== 'board-resolution')) {
    const rendered = renderDocPackItem(inputs, item);
    add(FOLDERS.generated, (await rendered.catch(() => null))?.filename ?? `${item.label}.docx`, async () => {
      const doc = await rendered.catch(() => null);
      return doc ? [doc.buffer] : null;
    });
  }

  for (const file of uploadedFiles(state)) {
    add(zipEntryPath(FOLDERS.uploaded, file.step), file.path.split('/').pop() ?? 'file', async () => {
      const bytes = await getObjectBuffer(bucketKey(MILESTONE_DOCUMENTS_BUCKET, file.path)).catch(() => null);
      return bytes ? [new Uint8Array(bytes)] : null;
    });
  }

  const br = await getBoardResolutionByEngagementId(ctx, inputs.dbId);
  if (br?.storagePath?.trim()) {
    add(FOLDERS.boardResolution, standardDownloadName('Board Resolution Draft', company, 'docx'), async () => {
      const bytes = await downloadBoardResolutionDocx(br.storagePath!);
      return bytes ? [sanitizeBoardResolutionDocxBuffer(Buffer.from(bytes))] : null;
    });
  }
  if (br?.signedStoragePath?.trim()) {
    const ext = br.signedStoragePath.split('.').pop() ?? 'pdf';
    add(FOLDERS.boardResolution, standardDownloadName('Board Resolution Signed', company, ext), async () => {
      const bytes = await downloadSignedBoardResolution(br.signedStoragePath!);
      return bytes ? [new Uint8Array(bytes)] : null;
    });
  }

  add(FOLDERS.audit, standardDownloadName('Audit Log', company, 'xlsx'), async () => {
    const rows = await listAuditEvents(ctx, { engagementId: inputs.dbId, limit: 5000 });
    return [
      await tablesWorkbook([
        {
          sheet: 'Audit log',
          columns: ['When', 'Who', 'Role', 'Action', 'What happened'],
          rows: rows.map((r) => [r.created_at, r.actor_name || r.actor_email || '', r.actor_role ?? '', r.action, r.summary ?? '']),
        },
      ]),
    ];
  });

  const bytes = await collect(createZipStream(entries));
  return {
    bytes,
    fileName: standardDownloadName('Project', company, 'zip'),
    companyName: company,
    engagementId: engagement.id,
  };
}

