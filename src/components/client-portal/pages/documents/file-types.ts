/**
 * File-type marks for the Documents pages and the shared viewer
 * (prototype docs_a_refined `TS` / `TT` maps). The type colour is only ever a
 * tint tile (DECISIONS: "file-type colours = thin band only; status is always
 * a separate badge").
 */
import type { CSSProperties } from 'react';

export type FileTag = 'PDF' | 'JPG' | 'PNG' | 'WEBP' | 'DOCX' | 'DOC' | 'HEIC' | 'FILE';
export type PreviewMode = 'pdf' | 'image' | 'docx' | 'none';

const EXT_TAG: Record<string, FileTag> = {
  pdf: 'PDF',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
  docx: 'DOCX',
  doc: 'DOC',
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
};

export function fileTag(name: string | null | undefined, contentType?: string | null): FileTag {
  const ext = (name ?? '').split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  if (EXT_TAG[ext]) return EXT_TAG[ext]!;
  const mime = (contentType ?? '').toLowerCase().split(';')[0]!.trim();
  return MIME_TAG[mime] ?? 'FILE';
}

/** Prototype TS: PDF over tint, images teal, Word blue. */
export const TAG_STYLE: Record<FileTag, CSSProperties> = {
  PDF: { background: 'var(--over-light)', color: 'var(--over-text)' },
  JPG: { background: 'var(--teal-light)', color: 'var(--teal-chip)' },
  PNG: { background: 'var(--teal-light)', color: 'var(--teal-chip)' },
  WEBP: { background: 'var(--teal-light)', color: 'var(--teal-chip)' },
  HEIC: { background: 'var(--teal-light)', color: 'var(--teal-chip)' },
  DOCX: { background: 'var(--prog-light)', color: 'var(--prog-text)' },
  DOC: { background: 'var(--prog-light)', color: 'var(--prog-text)' },
  FILE: { background: 'var(--raised)', color: 'var(--muted)' },
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
  FILE: 'File',
};

export function previewMode(tag: FileTag): PreviewMode {
  if (tag === 'PDF') return 'pdf';
  if (tag === 'JPG' || tag === 'PNG' || tag === 'WEBP') return 'image';
  if (tag === 'DOCX') return 'docx';
  return 'none';
}

/** "24 Oct 2026" — the one date format of the Documents pages. */
export function longDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "12 Nov" */
export function dayMonth(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
