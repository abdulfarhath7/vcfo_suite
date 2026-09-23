import 'server-only';

import { NextResponse } from 'next/server';
import PizZip from 'pizzip';

import { requireAnyRole, type AuthContext } from '@/auth/guards';
import { getDocPackInputs, type DocPackInputs } from '@/db/repositories/doc-pack';
import { validateIncorpDocsGeneration, IncorpDocsError } from '@/lib/api/incorporation-docs-errors';
import { sanitizeBoardResolutionDocxBuffer } from '@/lib/board-resolution-docx';
import { BOARD_RESOLUTION_DOCX_FILENAME } from '@/lib/board-resolution-storage';
import { evaluateDocPack, docPackItemByKey } from '@/lib/doc-pack/evaluate';
import type { DocPackItem, DocPackSummary } from '@/lib/doc-pack/types';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import { sanitizeIncorpDocxBufferWithReport } from '@/lib/incorporation-docs/docx-sanitize';
import { incorpDocDownloadFilename } from '@/lib/incorporation-docs/paths';
import { downloadIncorpDocx } from '@/lib/incorporation-docs/storage';
import { directorResponsesFromState } from '@/lib/proposed-directors';
import { slugifyCompanyName } from '@/lib/slug';
import { checklist } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import { downloadBoardResolutionDocx } from '@/storage/board-resolution';

/**
 * Document pack service — the only place that turns a pack item into bytes.
 *
 * Attached items (a Pre-7 `*DraftUrl` path or the finalized board resolution)
 * are served from storage as-is; generated items are rendered on demand from
 * `checklist_state` and never written anywhere. No checklist patch, no upload.
 */

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const ZIP_CONTENT_TYPE = 'application/zip';

export class DocPackError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'DocPackError';
    this.status = status;
    this.code = code;
  }
}

export type DocPackLoad = { ctx: AuthContext; inputs: DocPackInputs; summary: DocPackSummary };

/** Guard + repository + evaluation in one step; returns a ready-to-send error response otherwise. */
export async function loadDocPack(
  engagementParam: string,
): Promise<{ ok: true; load: DocPackLoad } | { ok: false; response: NextResponse }> {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }),
    };
  }
  const access = await getDocPackInputs(auth.ctx, engagementParam);
  if (access.ok === false) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: access.error }, { status: access.status }),
    };
  }
  const { inputs } = access;
  const summary = evaluateDocPack({
    state: inputs.checklistState,
    brRow: inputs.brRow,
    engagement: inputs.engagement,
  });
  return { ok: true, load: { ctx: auth.ctx, inputs, summary } };
}

export function docPackErrorResponse(err: unknown): NextResponse {
  if (err instanceof DocPackError) {
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof IncorpDocsError) {
    return NextResponse.json(
      { ok: false, error: err.message, code: err.code, missingFields: err.missingFields },
      { status: err.status === 422 ? 409 : err.status },
    );
  }
  const message = err instanceof Error ? err.message : 'The document could not be produced.';
  return NextResponse.json({ ok: false, error: message, code: 'render_failed' }, { status: 500 });
}

export interface RenderedDocPackItem {
  buffer: Buffer;
  filename: string;
}

export function requireReadyItem(summary: DocPackSummary, itemKey: string): DocPackItem {
  const item = docPackItemByKey(summary, itemKey);
  if (!item) throw new DocPackError('No such document in the pack.', 404, 'not_found');
  if (item.status !== 'ready') {
    throw new DocPackError(
      item.blockedBy ? item.blockedBy.label : 'This document still needs inputs.',
      409,
      'not_ready',
    );
  }
  return item;
}

export async function renderDocPackItem(
  inputs: DocPackInputs,
  item: DocPackItem,
): Promise<RenderedDocPackItem> {
  const { engagement, checklistState } = inputs;

  if (item.generate.kind === 'board-resolution') {
    const path = item.storagePath?.trim();
    if (!path) throw new DocPackError('The board resolution file is not stored yet.', 404, 'no_docx');
    const bytes = await downloadBoardResolutionDocx(path);
    if (!bytes) throw new DocPackError('The board resolution file could not be loaded.', 404, 'download_failed');
    return {
      buffer: sanitizeBoardResolutionDocxBuffer(Buffer.from(bytes)),
      filename: BOARD_RESOLUTION_DOCX_FILENAME,
    };
  }

  const { doc } = item.generate;
  const { pre6 } = directorResponsesFromState(checklistState);
  const filename = incorpDocDownloadFilename(doc, item.audience, { pre6 });

  if (item.source === 'attached' && item.storagePath) {
    const bytes = await downloadIncorpDocx(item.storagePath);
    if (!bytes) throw new DocPackError(`${item.label} could not be loaded from storage.`, 404, 'download_failed');
    // Read-only: a repaired buffer is returned, never written back.
    return { buffer: sanitizeIncorpDocxBufferWithReport(Buffer.from(bytes)).buffer, filename };
  }

  // Same validation the generate route applies, so "ready" never renders a placeholder.
  const { pre1, pre5, pre6: pre6Validated } = validateIncorpDocsGeneration({
    engagement,
    checklistState,
    docs: [doc],
    directors: [item.audience],
  });
  const buffer = renderIncorpDocxBuffer(doc, {
    engagement,
    pre1,
    pre5,
    pre6: pre6Validated,
    pre7: pre7Responses(checklistState),
    director: item.audience,
  });
  return { buffer, filename };
}

function pre7Responses(checklistState: Parameters<typeof validateIncorpDocsGeneration>[0]['checklistState']) {
  const item = checklist.find((c) => c.id === 'pre-7');
  return item ? extractItemResponses(item, checklistState?.['pre-7']) : {};
}

export function docPackZipFilename(engagement: { companyName: string; slug?: string }, now = new Date()): string {
  const slug = engagement.slug?.trim() || slugifyCompanyName(engagement.companyName);
  const day = now.toISOString().slice(0, 10);
  return `${slug}-pre-incorporation-${day}.zip`;
}

/** Zip of every ready item, flat, filenames as the single downloads use. */
export async function buildDocPackZip(
  inputs: DocPackInputs,
  summary: DocPackSummary,
): Promise<{ buffer: Buffer; filename: string; itemKeys: string[] }> {
  const ready = summary.items.filter((item) => item.status === 'ready');
  if (ready.length === 0) throw new DocPackError('No document is ready to download yet.', 409, 'none_ready');

  const zip = new PizZip();
  const used = new Set<string>();
  const itemKeys: string[] = [];
  for (const item of ready) {
    const rendered = await renderDocPackItem(inputs, item);
    let name = rendered.filename;
    // Two items can only collide if a filename pattern changes; keep both.
    if (used.has(name)) name = name.replace(/\.docx$/, `-${itemKeys.length + 1}.docx`);
    used.add(name);
    zip.file(name, rendered.buffer);
    itemKeys.push(item.key);
  }
  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  return { buffer, filename: docPackZipFilename(inputs.engagement), itemKeys };
}

export function fileResponse(
  buffer: Buffer,
  filename: string,
  contentType: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
