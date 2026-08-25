import { engagementDbId } from '@/lib/legacy-engagement-ids';
import {
  maxUploadSizeError,
  MILESTONE_DOCUMENT_EXTENSIONS,
  MILESTONE_DOCUMENT_MIME_TYPES,
  SUPABASE_MAX_UPLOAD_BYTES,
  validateUploadFileType,
} from '@/lib/upload-limits';

/**
 * Milestone document storage — CLIENT SIDE.
 *
 * Ported from the Supabase version. Two things changed, everything else is
 * byte-identical to the original:
 *
 *  1. The browser no longer holds storage credentials. In the original it
 *     called `supabase.storage.from(...).upload(...)` directly; here it POSTs
 *     to an API route which authenticates, authorises, and writes to S3. So
 *     the `supabase` first argument is gone from every function.
 *  2. The Supabase BUCKET is an S3 key PREFIX now (see bucketKey in
 *     src/storage/s3.ts). Stored paths are unchanged — still
 *     `{engagementUuid}/{fieldId}/{timestamp}-{filename}` — which is why the
 *     parsers below are LIFTed verbatim and still work on existing data.
 *
 * This module must stay client-safe: no `@/db/*`, no `@/storage/*` imports.
 */

/** Historic bucket name, now the S3 key prefix for these objects. */
export const MILESTONE_DOCUMENTS_BUCKET = 'milestone-documents';

const UNSUPPORTED_MESSAGE = 'Use PDF, Word (.doc/.docx), JPEG, PNG, or WebP.';

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'document';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
}

/** Storage object path: `{engagementUuid}/{fieldId}/{timestamp}-{filename}` */
export function milestoneDocumentObjectPath(
  appEngagementId: string,
  fieldId: string,
  fileName: string,
): string {
  const dbId = engagementDbId(appEngagementId);
  const safe = sanitizeFileName(fileName);
  return `${dbId}/${fieldId}/${Date.now()}-${safe}`;
}

export function validateMilestoneUploadFile(file: File): string | null {
  if (file.size > SUPABASE_MAX_UPLOAD_BYTES) {
    return maxUploadSizeError();
  }
  return validateUploadFileType(
    file,
    MILESTONE_DOCUMENT_EXTENSIONS,
    MILESTONE_DOCUMENT_MIME_TYPES,
    UNSUPPORTED_MESSAGE,
  );
}

/**
 * Upload via the API route. Validation runs client-side first for a fast error
 * message, and again on the server — never trust the browser's check alone.
 * Returns the stored object path.
 */
export async function uploadMilestoneDocument(
  appEngagementId: string,
  fieldId: string,
  file: File,
  options?: { stepId?: string },
): Promise<string> {
  const err = validateMilestoneUploadFile(file);
  if (err) throw new Error(err);

  const body = new FormData();
  body.append('fieldId', fieldId);
  if (options?.stepId?.trim()) body.append('stepId', options.stepId.trim());
  body.append('file', file);

  const res = await fetch(
    `/api/engagements/${encodeURIComponent(appEngagementId)}/milestone-documents`,
    { method: 'POST', body },
  );

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { path?: string };
  if (!data.path) throw new Error('Upload succeeded but no path was returned');
  return data.path;
}

/**
 * Short-lived download URL, minted server-side. Returns null (and warns) on
 * failure so callers can keep rendering — same contract as the original.
 */
export async function getMilestoneDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(
      `/api/milestone-documents/signed-url?path=${encodeURIComponent(trimmed)}` +
        `&expiresIn=${expiresInSeconds}`,
    );
    if (!res.ok) {
      console.warn('[milestone-documents] signed url failed', res.status);
      return null;
    }
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch (error) {
    console.warn('[milestone-documents] signed url failed', error);
    return null;
  }
}

export function fileNameFromStoragePath(path: string): string {
  const segment = path.split('/').pop() ?? path;
  const dash = segment.indexOf('-');
  if (dash > 0 && /^\d+$/.test(segment.slice(0, dash))) {
    return segment.slice(dash + 1);
  }
  return segment;
}

/** Parse upload timestamp embedded in `{engagementId}/{fieldId}/{timestamp}-{filename}`. */
export function uploadTimestampFromStoragePath(path: string): number | null {
  const segment = path.split('/').pop() ?? '';
  const dash = segment.indexOf('-');
  if (dash <= 0 || !/^\d+$/.test(segment.slice(0, dash))) return null;
  const ts = Number(segment.slice(0, dash));
  return Number.isFinite(ts) ? ts : null;
}

/** True when value looks like a milestone-documents object path (not plain text or http URL). */
export function isMilestoneStoragePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return false;
  const parts = trimmed.split('/');
  if (parts.length < 3) return false;
  const segment = parts[parts.length - 1] ?? '';
  const dash = segment.indexOf('-');
  return dash > 0 && /^\d+$/.test(segment.slice(0, dash));
}
