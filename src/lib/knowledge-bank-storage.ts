import {
  formatUploadFileSize,
  KNOWLEDGE_BANK_EXTENSIONS,
  KNOWLEDGE_BANK_MIME_TYPES,
  maxUploadSizeError,
  SUPABASE_MAX_UPLOAD_BYTES,
  validateUploadFileType,
} from '@/lib/upload-limits';

/**
 * Knowledge bank storage — CLIENT SIDE.
 *
 * Same port shape as milestone-document-storage.ts: the `supabase` argument is
 * gone because the browser has no storage credentials; upload/sign/delete go
 * through API routes which authorise and then talk to S3. The historic
 * 'knowledge-bank' bucket is now an S3 key prefix, and stored paths keep the
 * original `{fileId}/{timestamp}-{filename}` shape so
 * isKnowledgeBankStoragePath still holds.
 *
 * Must stay client-safe: no `@/db/*`, no `@/storage/*` imports.
 */

/** Historic bucket name, now the S3 key prefix for these objects. */
export const KNOWLEDGE_BANK_BUCKET = 'knowledge-bank';

const UNSUPPORTED_MESSAGE =
  'Use PDF, Word (.doc/.docx), Excel, PowerPoint, plain text, JPEG, PNG, or WebP.';

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'document';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
}

/** Storage object path: `{fileId}/{timestamp}-{filename}` */
export function knowledgeBankObjectPath(fileId: string, fileName: string): string {
  const safe = sanitizeFileName(fileName);
  return `${fileId}/${Date.now()}-${safe}`;
}

export function validateKnowledgeBankUploadFile(file: File): string | null {
  if (file.size > SUPABASE_MAX_UPLOAD_BYTES) {
    return maxUploadSizeError();
  }
  return validateUploadFileType(
    file,
    KNOWLEDGE_BANK_EXTENSIONS,
    KNOWLEDGE_BANK_MIME_TYPES,
    UNSUPPORTED_MESSAGE,
  );
}

/**
 * Upload through the API route. Returns `{ path, fileId }`.
 *
 * `fileId` is assigned on the server so LAN HTTP clients (no crypto.randomUUID)
 * still work. An optional client-provided id is accepted when valid.
 */
export async function uploadKnowledgeBankFile(
  file: File,
  fileId?: string,
): Promise<{ path: string; fileId: string }> {
  const err = validateKnowledgeBankUploadFile(file);
  if (err) throw new Error(err);

  const body = new FormData();
  if (fileId?.trim()) body.append('fileId', fileId.trim());
  body.append('file', file);

  const res = await fetch('/api/knowledge-bank/upload', { method: 'POST', body });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { path?: string; fileId?: string };
  if (!data.path || !data.fileId) {
    throw new Error('Upload succeeded but path/fileId was missing');
  }
  return { path: data.path, fileId: data.fileId };
}

export async function getKnowledgeBankSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(
      `/api/knowledge-bank/object?path=${encodeURIComponent(trimmed)}` +
        `&expiresIn=${expiresInSeconds}`,
    );
    if (!res.ok) {
      console.warn('[knowledge-bank] signed url failed', res.status);
      return null;
    }
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch (error) {
    console.warn('[knowledge-bank] signed url failed', error);
    return null;
  }
}

/**
 * Delete the stored object. Throws on failure (the original did too) so the
 * caller can surface it — the DB row deletion is handled by the same route.
 */
export async function removeKnowledgeBankStorageObject(storagePath: string): Promise<void> {
  const trimmed = storagePath.trim();
  if (!trimmed) return;

  const res = await fetch(
    `/api/knowledge-bank/object?path=${encodeURIComponent(trimmed)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Delete failed (${res.status})`);
  }
}

export function formatKnowledgeBankFileSize(bytes: number): string {
  return formatUploadFileSize(bytes);
}

/** True when path matches `{fileId}/{timestamp}-{filename}` from knowledgeBankObjectPath. */
export function isKnowledgeBankStoragePath(fileId: string, storagePath: string): boolean {
  const trimmed = storagePath.trim();
  if (!trimmed.startsWith(`${fileId}/`)) return false;
  const segment = trimmed.split('/').pop() ?? '';
  const dash = segment.indexOf('-');
  return dash > 0 && /^\d+$/.test(segment.slice(0, dash));
}
