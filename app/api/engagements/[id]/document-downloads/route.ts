import { NextResponse } from 'next/server';

import { requireAnyRole } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { DOCX_CONTENT_TYPE, ZIP_CONTENT_TYPE } from '@/lib/api/doc-pack';
import { bundleZipName, publicCatalog } from '@/lib/document-downloads/catalog';
import {
  downloadZipStream,
  loadDownloadCatalog,
  openDownloadFile,
  pickDownloadFiles,
  shouldBuildInBackground,
  type DownloadLayout,
} from '@/lib/document-downloads/bundle';
import { exportInBackground } from '@/lib/exports/background-export';
import { collectZipStream } from '@/lib/zip/zip-writer';

type RouteContext = { params: Promise<{ id: string }> };

/** Staff only: the Lead (intern), the Manager, the Admin and the Super admin. Clients are refused. */
const STAFF = ['super_admin', 'admin', 'manager', 'intern'] as const;

/** A background bundle is kept for its link up to this size. */
const BUNDLE_MAX_BYTES = 300 * 1024 * 1024;

const NO_STORE = 'private, no-store, max-age=0, must-revalidate';

const CONTENT_TYPES: Record<string, string> = {
  docx: DOCX_CONTENT_TYPE,
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: ZIP_CONTENT_TYPE,
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function contentTypeFor(fileName: string): string {
  return CONTENT_TYPES[fileName.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

function attachment(fileName: string): string {
  return `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** GET /api/engagements/[id]/document-downloads: the tree the "Download documents" pop-up shows. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...STAFF);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const result = await loadDownloadCatalog(guard.ctx, id);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(publicCatalog(result.loaded.catalog), { headers: { 'Cache-Control': NO_STORE } });
}

/**
 * POST /api/engagements/[id]/document-downloads with `{ keys, layout }`.
 * One file comes back as itself; a small set as a ZIP at once; a large set answers 202 and the
 * ZIP is made in the background, with a Download link in the bell when it is ready.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole(...STAFF);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { keys?: unknown; layout?: unknown } | null;
  const keys = Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === 'string').slice(0, 1000) : [];
  const layout: DownloadLayout = body?.layout === 'flat' ? 'flat' : 'folders';
  if (keys.length === 0) return NextResponse.json({ error: 'Choose at least one document.' }, { status: 400 });

  const result = await loadDownloadCatalog(guard.ctx, id);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  const { loaded } = result;
  const picked = pickDownloadFiles(loaded, keys);
  if (picked.length === 0) {
    return NextResponse.json({ error: 'None of the chosen documents is ready to download.' }, { status: 409 });
  }

  const { engagement } = loaded.inputs;
  const audit = (fileName: string, mode: 'file' | 'zip' | 'background') =>
    recordAuditEvent(guard.ctx, {
      engagementId: loaded.inputs.dbId,
      action: 'documents.download',
      summary: `Downloaded ${picked.length} ${picked.length === 1 ? 'document' : 'documents'} (${fileName})`,
      metadata: { fileName, mode, layout, keys: picked.map((p) => p.file.key) },
    });

  if (picked.length === 1) {
    const { file } = picked[0];
    const bytes = await openDownloadFile(loaded, file);
    if (!bytes) return NextResponse.json({ error: `${file.label} could not be loaded.` }, { status: 404 });
    await audit(file.fileName, 'file');
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { 'Content-Type': contentTypeFor(file.fileName), 'Content-Disposition': attachment(file.fileName), 'Cache-Control': NO_STORE },
    });
  }

  if (shouldBuildInBackground(picked)) {
    const fileName = bundleZipName(loaded.catalog, picked.map((p) => p.file.key));
    await audit(fileName, 'background');
    exportInBackground(guard.ctx, {
      kind: 'document_bundle',
      format: 'zip',
      fileName,
      label: 'the documents ZIP',
      engagementId: engagement.id,
      companyName: engagement.companyName,
      maxCopyBytes: BUNDLE_MAX_BYTES,
      build: () => collectZipStream(downloadZipStream(loaded, picked, layout).stream),
    });
    return NextResponse.json({ queued: true, fileName, count: picked.length }, { status: 202 });
  }

  const zip = downloadZipStream(loaded, picked, layout);
  await audit(zip.fileName, 'zip');
  return new Response(zip.stream, {
    status: 200,
    headers: { 'Content-Type': ZIP_CONTENT_TYPE, 'Content-Disposition': attachment(zip.fileName), 'Cache-Control': NO_STORE },
  });
}
