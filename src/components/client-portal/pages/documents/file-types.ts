/**
 * File-type marks for the Documents pages and the shared viewer
 * (prototype docs_a_refined `TS` / `TT` maps). The type colour is only ever a
 * tint tile (DECISIONS: "file-type colours = thin band only; status is always
 * a separate badge").
 */
import type { CSSProperties } from 'react';

export type FileTag = 'PDF' | 'JPG' | 'PNG' | 'WEBP' | 'DOCX' | 'DOC' | 'XLSX' | 'HEIC' | 'FILE';
export type PreviewMode = 'pdf' | 'image' | 'docx' | 'none';

const EXT_TAG: Record<string, FileTag> = {
  pdf: 'PDF',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
  docx: 'DOCX',
  doc: 'DOC',
  xlsx: 'XLSX',
  xls: 'XLSX',
  csv: 'XLSX',
  heic: 'HEIC',
  heif: 'HEIC',
};

const MIME_TAG: Record<string, FileTag> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/heic': 'HEIC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLSX',
  'text/csv': 'XLSX',
};

export function fileTag(name: string | null | undefined, contentType?: string | null): FileTag {
  const ext = (name ?? '').split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  if (EXT_TAG[ext]) return EXT_TAG[ext]!;
  const mime = (contentType ?? '').toLowerCase().split(';')[0]!.trim();
  return MIME_TAG[mime] ?? 'FILE';
}

/* R-26: file badges are coloured by type, the same tones as the shared FileBadge:
   PDF red, Word blurple, spreadsheets green, images violet, anything else grey. */
const PDF_TONE: CSSProperties = { background: 'oklch(var(--danger-soft))', color: 'oklch(var(--danger))' };
const IMG_TONE: CSSProperties = { background: 'oklch(var(--identity-soft))', color: 'oklch(var(--identity))' };
const DOC_TONE: CSSProperties = { background: 'oklch(var(--brand-soft))', color: 'oklch(var(--brand-text))' };
const XLS_TONE: CSSProperties = { background: 'oklch(var(--positive-soft))', color: 'oklch(var(--positive))' };
const ANY_TONE: CSSProperties = { background: 'oklch(var(--upcoming-soft))', color: 'oklch(var(--upcoming))' };
export const TAG_STYLE: Record<FileTag, CSSProperties> = {
  PDF: PDF_TONE,
  JPG: IMG_TONE,
  PNG: IMG_TONE,
  WEBP: IMG_TONE,
  HEIC: IMG_TONE,
  DOCX: DOC_TONE,
  DOC: DOC_TONE,
  XLSX: XLS_TONE,
  FILE: ANY_TONE,
};

/** Prototype TT (rule 17 tooltip + aria-label). */
export const TAG_TIP: Record<FileTag, string> = {
  PDF: 'PDF file',
  JPG: 'Image (JPG)',
  PNG: 'Image (PNG)',
  WEBP: 'Image (WEBP)',
  HEIC: 'Image (HEIC)',
  DOCX: 'Word document',
  DOC: 'Word document',
  XLSX: 'Spreadsheet',
  FILE: 'File',
};

export function previewMode(tag: FileTag): PreviewMode {
  if (tag === 'PDF') return 'pdf';
  if (tag === 'JPG' || tag === 'PNG' || tag === 'WEBP') return 'image';
  if (tag === 'DOCX') return 'docx';
  return 'none';
}

/** "24 Oct 2026" — the one date format of the Documents pages. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDay(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Fixed 3-letter months: en-GB toLocaleDateString renders "Sept". */
export const MONTHS_SHORT = MONTHS;

export function longDate(iso?: string | null): string {
  const d = parseDay(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—';
}

/** "12 Nov" */
export function dayMonth(iso?: string | null): string {
  const d = parseDay(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '—';
}

export function sizeLabel(bytes?: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Trigger a browser download of a URL (same-origin URLs honour the file name). */
export function triggerDownload(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  if (!url.startsWith('/') && !url.startsWith(window.location.origin)) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
