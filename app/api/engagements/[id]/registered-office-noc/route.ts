import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import {
  getRegisteredOfficeNoc,
  NocAccessError,
  nocEngagementDbId,
  nocObjectKey,
  saveGeneratedNoc,
} from '@/db/repositories/registered-office-noc';
import { checkNoc, coerceNocInput, nocFileName } from '@/lib/registered-office-noc/model';
import { buildNocDocx, DOCX_CONTENT_TYPE } from '@/lib/registered-office-noc/docx';
import { bucketKey, putObject } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

function failure(err: unknown) {
  if (err instanceof NocAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
  const message = err instanceof Error ? err.message : 'noc_failed';
  return NextResponse.json({ error: message }, { status: 500 });
}

/** GET /api/engagements/:id/registered-office-noc — the project's NOC, or null. Staff with access. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ noc: await getRegisteredOfficeNoc(guard.ctx, id) });
  } catch (err) {
    return failure(err);
  }
}

/**
 * POST /api/engagements/:id/registered-office-noc — generate the NOC as a Word
 * file (first time, or again after the details changed). Body: { input }.
 * Field errors block (400 with `fields`); warnings never do. Manager (own
 * project) or admin.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  let body: { input?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const noc = coerceNocInput(body.input);
  const { errors } = checkNoc(noc);
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: 'A few NOC fields still need you', fields: errors }, { status: 400 });
  }
  try {
    const dbId = await nocEngagementDbId(guard.ctx, id);
    const fileName = nocFileName(noc.companyName);
    const path = nocObjectKey(dbId, 'generated', fileName);
    await putObject(bucketKey('engagement-documents', path), buildNocDocx(noc), DOCX_CONTENT_TYPE);
    const saved = await saveGeneratedNoc(guard.ctx, id, { noc, fileName, key: path });
    return NextResponse.json({ noc: saved }, { status: 201 });
  } catch (err) {
    return failure(err);
  }
}
