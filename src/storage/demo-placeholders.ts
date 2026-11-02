import 'server-only';

import { ENGAGEMENT_DOCUMENTS_BUCKET } from '@/lib/board-resolution/board-resolution-storage';
import {
  isMilestoneStoragePath,
  MILESTONE_DOCUMENTS_BUCKET,
} from '@/lib/documents/milestone-document-storage';
import { bucketKey, objectExists, putObject, type StorageBucket } from '@/storage/s3';

/**
 * Placeholder files for the demo seed (scripts/seed-demo.ts and seed-demo-extras.ts).
 *
 * The demo seed writes document rows that point at object keys. Without an object at the key
 * the Documents pages ask for a file that is not there. These helpers put a small one-page PDF
 * at each key, and skip a key that already has an object. Only the demo seed calls them; the
 * real upload paths never do.
 */

/**
 * documents.object_key to the S3 key: the same mapping as `/api/documents/[id]/signed-url`
 * and the client Documents repository (a bucket prefix, else a milestone path, else the
 * engagement documents bucket).
 */
export function documentStorageKey(objectKey: string): string {
  const clean = objectKey.replace(/^\/+/, '');
  const prefixed = (bucket: StorageBucket) =>
    clean.startsWith(`${bucket}/`) ? bucketKey(bucket, clean.slice(bucket.length + 1)) : null;
  return (
    prefixed(MILESTONE_DOCUMENTS_BUCKET) ??
    prefixed(ENGAGEMENT_DOCUMENTS_BUCKET) ??
    bucketKey(isMilestoneStoragePath(clean) ? MILESTONE_DOCUMENTS_BUCKET : ENGAGEMENT_DOCUMENTS_BUCKET, clean)
  );
}

/** PDF string literal: keep printable ASCII and escape the three special characters. */
function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, '-')
    .replace(/[\\()]/g, (c) => `\\${c}`)
    .slice(0, 90);
}

/** A valid one-page PDF that names the document and says it is demo data. */
export function placeholderPdf(title: string): Buffer {
  const stream = `BT /F1 18 Tf 72 740 Td (${pdfText(title)}) Tj 0 -28 Td /F1 11 Tf (Demo placeholder file. Not a real document.) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/** Upload a placeholder PDF at `key` unless an object is already there. */
export async function putPlaceholderIfMissing(key: string, title: string): Promise<'uploaded' | 'exists'> {
  if (await objectExists(key)) return 'exists';
  await putObject(key, placeholderPdf(title), 'application/pdf');
  return 'uploaded';
}

/**
 * Seed helper: upload placeholders for many keys. The first storage failure (MinIO is down,
 * no bucket) stops the uploads with one warning, so the database seed still finishes.
 */
export async function seedPlaceholders(
  files: Array<{ key: string; title: string }>,
): Promise<{ uploaded: number; existing: number; failed: string | null }> {
  let uploaded = 0;
  let existing = 0;
  for (const file of files) {
    try {
      if ((await putPlaceholderIfMissing(file.key, file.title)) === 'uploaded') uploaded += 1;
      else existing += 1;
    } catch (err) {
      return { uploaded, existing, failed: err instanceof Error ? err.message : String(err) };
    }
  }
  return { uploaded, existing, failed: null };
}
