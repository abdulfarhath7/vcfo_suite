import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AuthContext } from '@/auth/guards';
import { putObject } from '@/storage/s3';
import { recordExportFileForUser } from '@/db/repositories/export-files';

/**
 * Log an export the app made (P-373): keep a copy in S3 under `exports/` (the daily cleanup
 * removes it after 30 days) and write an `export_files` row. It never throws and never
 * changes what the person downloads: a failed upload still writes the row, without a copy.
 */

export type ExportKind =
  | 'audit_log'
  | 'vault_zip'
  | 'client_vault_zip'
  | 'partner_report'
  | 'client_audit'
  /** An act-wise archive of one batch of labour registers. */
  | 'labour_registers_zip'
  /** PR-02: the whole project as one ZIP, made in the background. */
  | 'project_zip'
  /** GL-06: a list exported to Excel, made in the background. */
  | 'table_xlsx'
  /** "Download documents": the documents a staff member picked in the pop-up, as one ZIP. */
  | 'document_bundle';

/** The largest file kept in S3; a bigger one is logged without a copy. */
const EXPORT_COPY_MAX_BYTES = 50 * 1024 * 1024;

export const EXPORT_CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  zip: 'application/zip',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const TYPES = EXPORT_CONTENT_TYPES;

function exportKey(fileName: string, now = new Date()): string {
  const safe = fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'export';
  return `exports/${now.toISOString().slice(0, 7)}/${randomUUID()}-${safe}`;
}

/** Returns the export's id, so a background export can link to its copy (null when not logged). */
export async function recordExport(
  ctx: AuthContext,
  input: { kind: ExportKind; format: 'csv' | 'zip' | 'pdf' | 'xlsx'; fileName: string; body: Uint8Array | string; maxCopyBytes?: number },
): Promise<string | null> {
  try {
    const size = typeof input.body === 'string' ? Buffer.byteLength(input.body) : input.body.byteLength;
    let key: string | null = null;
    if (size <= (input.maxCopyBytes ?? EXPORT_COPY_MAX_BYTES)) {
      key = exportKey(input.fileName);
      try {
        await putObject(key, input.body, TYPES[input.format]);
      } catch (err) {
        console.warn('[exports] copy not kept', err instanceof Error ? err.message : err);
        key = null;
      }
    }
    const id = await recordExportFileForUser(ctx, { kind: input.kind, format: input.format, fileName: input.fileName, sizeBytes: size, objectKey: key });
    return key ? id : null;
  } catch (err) {
    console.warn('[exports] not logged', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * For a streamed export (the vault ZIP): returns the stream to send, and logs the export
 * once the stream ends. Up to EXPORT_COPY_MAX_BYTES the bytes are also collected for the S3
 * copy; past that the copy stops and only the size is counted.
 */
export function recordStreamExport(
  ctx: AuthContext,
  input: { kind: ExportKind; format: 'zip'; fileName: string },
  stream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let keep = true;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (keep) {
        if (size <= EXPORT_COPY_MAX_BYTES) chunks.push(chunk);
        else {
          keep = false;
          chunks.length = 0;
        }
      }
      controller.enqueue(chunk);
    },
    async flush() {
      if (keep) {
        await recordExport(ctx, { ...input, body: Buffer.concat(chunks) });
      } else {
        try {
          await recordExportFileForUser(ctx, { kind: input.kind, format: input.format, fileName: input.fileName, sizeBytes: size, objectKey: null });
        } catch (err) {
          console.warn('[exports] not logged', err instanceof Error ? err.message : err);
        }
      }
    },
  });
  return stream.pipeThrough(counter);
}
