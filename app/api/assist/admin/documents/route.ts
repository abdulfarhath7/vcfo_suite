import { NextResponse } from 'next/server';
import {
  createAssistDocument,
  listAssistDocuments,
  setAssistDocumentStorageKey,
  type AssistDocumentAudience,
  type AssistSourceType,
} from '@/db/repositories/assist-documents';
import { isFirmWideAdmin } from '@/lib/auth';
import { assistSourceStoragePath, queueAssistIngestion } from '@/lib/assist/ingest/run';
import { sourceKindFor } from '@/lib/assist/ingest/extract';
import { requireAssist } from '@/lib/assist/route-guard';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import { bucketKey, putObject } from '@/storage/s3';

const SOURCE_TYPES: readonly AssistSourceType[] = ['govt', 'firm_pdf', 'firm_note'];
const AUDIENCES: readonly AssistDocumentAudience[] = ['client', 'staff', 'both'];

function view(row: Awaited<ReturnType<typeof listAssistDocuments>>[number]) {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    audience: row.audience,
    status: row.status,
    error: row.error,
    effectiveFrom: row.effectiveFrom,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** GET /api/assist/admin/documents — knowledge sources (admin / super admin). */
export async function GET() {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    return NextResponse.json({ documents: (await listAssistDocuments(gate.ctx)).map(view) });
  } catch (error) {
    console.error('[assist] sources list failed', error);
    return NextResponse.json({ error: 'Could not load sources' }, { status: 500 });
  }
}

/**
 * POST /api/assist/admin/documents — multipart: title, sourceType, audience,
 * optional sourceUrl / effectiveFrom, and either `file` (PDF, DOCX, TXT, MD)
 * or `note` (firm note text). Stores the bytes in S3, then queues indexing.
 */
export async function POST(request: Request) {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const sourceType = String(form.get('sourceType') ?? '') as AssistSourceType;
  const audience = String(form.get('audience') ?? '') as AssistDocumentAudience;
  const sourceUrlRaw = String(form.get('sourceUrl') ?? '').trim();
  const effectiveFrom = String(form.get('effectiveFrom') ?? '').trim() || null;
  const note = String(form.get('note') ?? '').trim();
  const file = form.get('file');

  if (!title) return NextResponse.json({ error: 'Give the source a title' }, { status: 400 });
  if (!SOURCE_TYPES.includes(sourceType)) return NextResponse.json({ error: 'Choose a source type' }, { status: 400 });
  if (!AUDIENCES.includes(audience)) return NextResponse.json({ error: 'Choose who may see answers from it' }, { status: 400 });
  if (effectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return NextResponse.json({ error: 'Effective date must be a date' }, { status: 400 });
  }
  let sourceUrl: string | null = null;
  if (sourceUrlRaw) {
    try {
      const url = new URL(sourceUrlRaw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
      sourceUrl = url.toString();
    } catch {
      return NextResponse.json({ error: 'Source link must be a web address' }, { status: 400 });
    }
  }

  let bytes: Buffer;
  let fileName: string;
  let contentType: string;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'That file is too large' }, { status: 413 });
    if (!sourceKindFor(file.name, file.type)) {
      return NextResponse.json({ error: 'Upload a PDF, DOCX, TXT or MD file' }, { status: 400 });
    }
    bytes = Buffer.from(await file.arrayBuffer());
    fileName = file.name;
    contentType = file.type || 'application/octet-stream';
  } else if (note) {
    bytes = Buffer.from(note.slice(0, 200_000), 'utf8');
    fileName = 'note.md';
    contentType = 'text/markdown';
  } else {
    return NextResponse.json({ error: 'Attach a file or write a note' }, { status: 400 });
  }

  try {
    const doc = await createAssistDocument(gate.ctx, { title, sourceType, audience, sourceUrl, effectiveFrom });
    const key = bucketKey('knowledge-bank', assistSourceStoragePath(doc.id, fileName));
    await putObject(key, bytes, contentType);
    await setAssistDocumentStorageKey(gate.ctx, doc.id, key);
    const mode = await queueAssistIngestion(doc.id);
    return NextResponse.json({ document: view({ ...doc, s3Key: key }), indexing: mode }, { status: 201 });
  } catch (error) {
    console.error('[assist] source upload failed', error);
    return NextResponse.json({ error: 'Could not save the source' }, { status: 500 });
  }
}
