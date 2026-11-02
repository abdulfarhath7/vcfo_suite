import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import {
  attachSignedNoc,
  NocAccessError,
  nocEngagementDbId,
  nocObjectKey,
} from '@/db/repositories/registered-office-noc';
import { validateMilestoneUploadFile } from '@/lib/milestone-document-storage';
import { MILESTONE_DOCUMENT_EXTENSIONS, resolveUploadContentType } from '@/lib/upload-limits';
import { bucketKey, putObject } from '@/storage/s3';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/engagements/:id/registered-office-noc/signed — multipart `file`:
 * the signed NOC (PDF, Word or an image, the milestone upload rules). Manager
 * (own project) or admin.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file' }, { status: 400 });
  const invalid = validateMilestoneUploadFile(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  try {
    const dbId = await nocEngagementDbId(guard.ctx, id);
    const path = nocObjectKey(dbId, 'signed', file.name);
    await putObject(
      bucketKey('engagement-documents', path),
      Buffer.from(await file.arrayBuffer()),
      resolveUploadContentType(file, MILESTONE_DOCUMENT_EXTENSIONS),
    );
    return NextResponse.json({ noc: await attachSignedNoc(guard.ctx, id, { key: path, fileName: file.name }) });
  } catch (err) {
    if (err instanceof NocAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'upload_failed' }, { status: 500 });
  }
}
