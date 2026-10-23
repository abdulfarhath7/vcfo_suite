/**
 * Ask VCFO sources — what the admin may upload, checked in the browser before
 * the request and again on the server (`sourceKindFor` in ingest/extract.ts).
 * Pure so the drop zone and its tests share one rule.
 */
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

export const ASK_SOURCE_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;
export const ASK_SOURCE_ACCEPT = ASK_SOURCE_EXTENSIONS.map((e) => `.${e}`).join(',');

export interface SourceFileLike {
  name: string;
  size: number;
  type?: string;
}

export function sourceFileExtension(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

/** Null when the file is acceptable; otherwise the message to show. */
export function validateSourceFile(file: SourceFileLike): string | null {
  const ext = sourceFileExtension(file.name);
  if (!(ASK_SOURCE_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" is not a PDF, DOCX, TXT or MD file.`;
  }
  if (file.size <= 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) return `"${file.name}" is larger than ${MAX_UPLOAD_MB} MB.`;
  return null;
}

/** "GST-return-filing_FY26.pdf" → "GST return filing FY26" (a default title the admin can edit). */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
