import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAskAttachment } from '@/db/repositories/ask-attachments';
import { attachmentTypeOf, READABLE_EXTENSIONS } from '@/lib/ask/data-router/read';
import { requireAsk } from '@/lib/ask/route-guard';
import { MAX_UPLOAD_BYTES, maxUploadSizeError } from '@/lib/upload-limits';
import { putObject } from '@/storage/s3';

/** POST /api/ask/attachments: stores one file for the chat. Reading it happens at the next message. */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: maxUploadSizeError() }, { status: 400 });
  const fileName = file.name.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'file';
  if (!READABLE_EXTENSIONS.has(fileName.toLowerCase().split('.').pop() ?? '')) {
    return NextResponse.json({ error: 'I can read PDF, Word, Excel, CSV, text and image files.' }, { status: 400 });
  }
  const s3Key = `ask/attachments/${gate.ctx.userId}/${randomUUID()}/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = attachmentTypeOf(fileName, bytes);
  if (!contentType) return NextResponse.json({ error: 'This file is not what its name says it is.' }, { status: 400 });
  await putObject(s3Key, bytes, contentType);
  const row = await createAskAttachment(gate.ctx, { kind: 'file', fileName, contentType, sizeBytes: file.size, s3Key });
  return NextResponse.json({ id: row.id, fileName: row.fileName });
}
