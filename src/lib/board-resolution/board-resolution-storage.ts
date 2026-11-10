import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import {
  EXTENSION_TO_MIME,
  maxUploadSizeError,
  SIGNED_BOARD_RESOLUTION_EXTENSIONS,
  SIGNED_BOARD_RESOLUTION_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  validateUploadFileType,
} from '@/lib/upload-limits';

/**
 * Board-resolution storage — CLIENT-SAFE half (paths, validation, upload).
 *
 * The byte-level read/write lives in src/storage/board-resolution.ts because
 * it imports the S3 client. This file is imported by client views AND by
 * upload-limits.test.ts, so it must not pull in `server-only` or `@/storage/*`.
 *
 * The historic 'engagement-documents' bucket is now an S3 key prefix; the
 * object paths below are unchanged from the original.
 */

/** Historic bucket name, now the S3 key prefix for these objects. */
export const ENGAGEMENT_DOCUMENTS_BUCKET = 'engagement-documents';

export const BOARD_RESOLUTION_DOCX_FILENAME = 'board-resolution.docx';

/**
 * The name a downloaded board resolution gets (owner, 10 Nov):
 * `Board-resolution-<company>-<date>.docx`, e.g.
 * `Board-resolution-Sahyadri-Robotics-India-Private-Limited-10-Nov-2026.docx` (date in India
 * time). Only letters,
 * digits and hyphens are kept, so the name is safe in every browser and file system. The
 * stored object keeps its fixed key (`BOARD_RESOLUTION_DOCX_FILENAME`).
 */
export function boardResolutionDownloadName(companyName: string | null | undefined, on: Date = new Date()): string {
  const company = (companyName ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  // India time, so a download near midnight is not dated the day before on the server.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
    .formatToParts(on)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const date = `${parts.day}-${parts.month}-${parts.year}`;
  return company ? `Board-resolution-${company}-${date}.docx` : `Board-resolution-${date}.docx`;
}

const UNSUPPORTED_MESSAGE = 'Use a PDF or Word (.docx) file.';

/** Storage object path: `{engagementUuid}/board-resolution.docx` */
export function boardResolutionStoragePath(appEngagementId: string): string {
  const dbId = engagementDbId(appEngagementId);
  return `${dbId}/${BOARD_RESOLUTION_DOCX_FILENAME}`;
}

/** Storage object path: `{engagementUuid}/signed/board-resolution-signed-{timestamp}.{ext}` */
export function signedBoardResolutionStoragePath(
  appEngagementId: string,
  extension: string,
): string {
  const dbId = engagementDbId(appEngagementId);
  const ext = extension.toLowerCase();
  return `${dbId}/signed/board-resolution-signed-${Date.now()}.${ext}`;
}

export function validateSignedBoardResolutionFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return maxUploadSizeError();
  }
  return validateUploadFileType(
    file,
    SIGNED_BOARD_RESOLUTION_EXTENSIONS,
    SIGNED_BOARD_RESOLUTION_MIME_TYPES,
    UNSUPPORTED_MESSAGE,
  );
}

export function contentTypeForSignedBoardResolutionPath(path: string): string {
  if (path.toLowerCase().endsWith('.pdf')) return EXTENSION_TO_MIME.pdf;
  return EXTENSION_TO_MIME.docx;
}

export function downloadFilenameForSignedBoardResolution(path: string): string {
  const segment = path.split('/').pop() ?? 'board-resolution-signed';
  return segment.replace(/^board-resolution-signed-\d+\./, 'board-resolution-signed.');
}

export interface SignedBoardResolutionUploadResult {
  path: string;
  signedUploadedAt?: string;
  signedStoragePath?: string;
}

/**
 * Upload the client's signed copy.
 *
 * The original did this in two steps — write to Supabase Storage from the
 * browser, then POST the resulting path to a route to record it — and had to
 * delete the orphaned object by hand if step two failed. Here ONE request
 * carries the file: the route writes to S3 and stamps signed_storage_path /
 * signed_uploaded_by in the same handler, so a failure leaves nothing behind
 * and callers need no compensating delete.
 */
export async function uploadSignedBoardResolution(
  appEngagementId: string,
  file: File,
): Promise<SignedBoardResolutionUploadResult> {
  const err = validateSignedBoardResolutionFile(file);
  if (err) throw new Error(err);

  const body = new FormData();
  body.append('file', file);

  const res = await fetch(
    `/api/engagements/${encodeURIComponent(appEngagementId)}/board-resolution/upload-signed`,
    { method: 'POST', body, credentials: 'include' },
  );

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as SignedBoardResolutionUploadResult;
  if (!data.path) throw new Error('Upload succeeded but no path was returned');
  return data;
}
