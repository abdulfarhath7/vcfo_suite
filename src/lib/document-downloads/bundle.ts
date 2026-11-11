import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { getDocPackInputs, type DocPackInputs } from '@/db/repositories/doc-pack';
import { docPackItemFilename, renderDocPackItem } from '@/lib/api/doc-pack';
import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import type { DocPackItem } from '@/lib/doc-pack/types';
import { MILESTONE_DOCUMENTS_BUCKET } from '@/lib/documents/milestone-document-storage';
import { tablesWorkbook } from '@/lib/exports/table-xlsx';
import { answersTable, entriesTable, groupOf, type Responses } from '@/lib/projects/project-zip-tables';
import { createUniqueNamer, zipEntryPath } from '@/lib/zip/entry-names';
import { createZipStream, type ZipEntrySource } from '@/lib/zip/zip-writer';
import { downloadSignedBoardResolution } from '@/storage/board-resolution';
import { bucketKey, getObjectBuffer } from '@/storage/s3';
import {
  buildDownloadCatalog,
  bundleZipName,
  pickFiles,
  type DownloadCatalog,
  type DownloadFile,
  type PickedFile,
  type ProjectRecord,
} from '@/lib/document-downloads/catalog';

/**
 * Server side of "Download documents": load the engagement through the document pack repository
 * (which takes the `AuthContext`, so a Lead only reaches the engagements they lead and a client is
 * refused), build the catalog, and turn the picked keys into one file or a ZIP.
 */

export type DownloadLayout = 'folders' | 'flat';

/** Up to this many files, and this many uploads among them, the ZIP streams straight back. */
export const DIRECT_MAX_FILES = 25;
export const DIRECT_MAX_UPLOADS = 5;

export interface LoadedCatalog {
  ctx: AuthContext;
  inputs: DocPackInputs;
  catalog: DownloadCatalog;
  packItems: Map<string, DocPackItem>;
}

export async function loadDownloadCatalog(
  ctx: AuthContext,
  engagementParam: string,
): Promise<{ ok: true; loaded: LoadedCatalog } | { ok: false; status: number; error: string }> {
  const access = await getDocPackInputs(ctx, engagementParam);
  if (access.ok === false) return { ok: false, status: access.status, error: access.error };
  const { inputs } = access;
  const summary = evaluateDocPack({ state: inputs.checklistState, brRow: inputs.brRow, engagement: inputs.engagement });
  const catalog = buildDownloadCatalog({
    companyName: inputs.engagement.companyName,
    packItems: summary.items,
    packFileName: (item) => docPackItemFilename(inputs, item),
    signedBoardResolutionPath: inputs.brRow?.signedStoragePath,
    state: inputs.checklistState as Parameters<typeof buildDownloadCatalog>[0]['state'],
  });
  return { ok: true, loaded: { ctx, inputs, catalog, packItems: new Map(summary.items.map((i) => [i.key, i])) } };
}

/** The bytes of one file, or null when storage no longer has it. */
export async function openDownloadFile(loaded: LoadedCatalog, file: DownloadFile): Promise<Uint8Array | null> {
  const { source } = file;
  if (source.type === 'pack') {
    const item = loaded.packItems.get(source.itemKey);
    if (!item) return null;
    const rendered = await renderDocPackItem(loaded.inputs, item).catch(() => null);
    return rendered ? new Uint8Array(rendered.buffer) : null;
  }
  if (source.type === 'record') return recordWorkbook(loaded, source.record);
  if (source.type === 'br-signed') {
    const bytes = await downloadSignedBoardResolution(source.path).catch(() => null);
    return bytes ? new Uint8Array(bytes) : null;
  }
  const bytes = await getObjectBuffer(bucketKey(MILESTONE_DOCUMENTS_BUCKET, source.path)).catch(() => null);
  return bytes ? new Uint8Array(bytes) : null;
}

/** PR-02's spreadsheets: every answer, the directors, the subscribers and the audit log. */
async function recordWorkbook(loaded: LoadedCatalog, record: ProjectRecord): Promise<Uint8Array> {
  const state = loaded.inputs.checklistState as Record<string, { responses?: Responses } | undefined>;
  if (record === 'answers') return tablesWorkbook([answersTable(state)]);
  if (record === 'directors') {
    return tablesWorkbook([entriesTable('Proposed directors', groupOf('pre-15', 'directors'), state['pre-15']?.responses ?? {})]);
  }
  if (record === 'subscribers') {
    return tablesWorkbook([entriesTable('Subscribers', groupOf('pre-16', 'subscribers'), state['pre-16']?.responses ?? {})]);
  }
  const rows = await listAuditEvents(loaded.ctx, { engagementId: loaded.inputs.dbId, limit: 5000 });
  return tablesWorkbook([
    {
      sheet: 'Audit log',
      columns: ['When', 'Who', 'Role', 'Action', 'What happened'],
      rows: rows.map((r) => [r.created_at, r.actor_name || r.actor_email || '', r.actor_role ?? '', r.action, r.summary ?? '']),
    },
  ]);
}

export function pickDownloadFiles(loaded: LoadedCatalog, keys: readonly string[]): PickedFile[] {
  return pickFiles(loaded.catalog, keys);
}

/** Small selections stream back at once; anything bigger is made in the background. */
export function shouldBuildInBackground(picked: readonly PickedFile[]): boolean {
  const uploads = picked.filter((p) => p.file.kind === 'uploaded').length;
  return picked.length > DIRECT_MAX_FILES || uploads > DIRECT_MAX_UPLOADS;
}

/** The ZIP as a stream: each file is read only when the writer reaches it. */
export function downloadZipStream(
  loaded: LoadedCatalog,
  picked: readonly PickedFile[],
  layout: DownloadLayout,
): { stream: ReadableStream<Uint8Array>; fileName: string } {
  const unique = createUniqueNamer();
  const entries: ZipEntrySource[] = picked.map(({ file, folders }) => ({
    name: unique(zipEntryPath(layout === 'folders' ? folders.join('/') : '', file.fileName)),
    open: async () => {
      const bytes = await openDownloadFile(loaded, file);
      return bytes ? [bytes] : null;
    },
  }));
  return {
    stream: createZipStream(entries),
    fileName: bundleZipName(loaded.catalog, picked.map((p) => p.file.key)),
  };
}
