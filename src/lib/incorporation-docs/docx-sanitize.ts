import PizZip from 'pizzip';

import { dedupeXmlAttributes } from '@/lib/board-resolution/board-resolution-docx-body';

/** Remove duplicate XML attributes (e.g. repeated xml:space) from word/document.xml. */
export function sanitizeIncorpDocumentXml(documentXml: string): string {
  return dedupeXmlAttributes(documentXml);
}

export type IncorpDocxSanitizeResult = {
  buffer: Buffer;
  changed: boolean;
  repairedEntries: string[];
};

const INVALID_XML_CHARS =
  // eslint-disable-next-line no-control-regex -- intentional: these control chars are invalid in XML 1.0 and are stripped from generated DOCX
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/g;

function normalizeXmlEntry(xml: string): string {
  return dedupeXmlAttributes(xml).replace(INVALID_XML_CHARS, '');
}

/**
 * Normalize malformed XML across all `.xml` entries in a .docx buffer.
 * Repairs:
 * - duplicate attributes (e.g. repeated xml:space)
 * - invalid XML control/surrogate characters introduced by copy-paste input
 */
export function sanitizeIncorpDocxBufferWithReport(docx: Buffer): IncorpDocxSanitizeResult {
  const zip = new PizZip(docx);
  let changed = false;
  const repairedEntries: string[] = [];

  for (const entry of zip.file(/\.xml$/)) {
    const xml = entry.asText();
    const cleaned = normalizeXmlEntry(xml);
    if (cleaned === xml) continue;
    zip.file(entry.name, cleaned);
    changed = true;
    repairedEntries.push(entry.name);
  }

  if (!changed) {
    return { buffer: docx, changed: false, repairedEntries: [] };
  }

  const buffer = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  return { buffer, changed: true, repairedEntries };
}

/** Backward-compatible wrapper returning only sanitized bytes. */
export function sanitizeIncorpDocxBuffer(docx: Buffer): Buffer {
  return sanitizeIncorpDocxBufferWithReport(docx).buffer;
}

/** Parts of a .docx that carry visible text (body, headers, footers, notes). */
const TEXT_PART = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

/** `<w:highlight …/>` (self-closing or empty pair) and yellow run shading. */
const HIGHLIGHT_MARKUP = /<w:highlight\b[^>]*\/>|<w:highlight\b[^>]*>\s*<\/w:highlight>/g;
const YELLOW_SHADING = /<w:shd\b[^>]*w:fill="FFFF00"[^>]*\/>/gi;

/** The XML of one text part without its highlight markup. */
export function stripHighlightsFromXml(xml: string): string {
  return xml.replace(HIGHLIGHT_MARKUP, '').replace(YELLOW_SHADING, '');
}

/**
 * The templates mark every merged value in yellow so the preview shows what
 * was filled in. A downloaded file is the clean copy the client signs, so the
 * marking is removed there; stored drafts keep it for the next preview.
 */
export function stripDocxHighlights(docx: Buffer): Buffer {
  const zip = new PizZip(docx);
  let changed = false;
  for (const entry of zip.file(TEXT_PART)) {
    const xml = entry.asText();
    const cleaned = stripHighlightsFromXml(xml);
    if (cleaned === xml) continue;
    zip.file(entry.name, cleaned);
    changed = true;
  }
  if (!changed) return docx;
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

const TABLE_CELL = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
const CENTRED_OR_RIGHT = /<w:jc w:val="(?:center|right|end)"\s*\/>/g;

/**
 * Table cells that hold a merge tag (`{DIRECTOR_DIN}`) are left-aligned, so
 * every filled-in value in a details column starts at the same left edge.
 * Header and label cells hold no tag and keep their alignment.
 */
export function leftAlignTableValueCells(documentXml: string): string {
  return documentXml.replace(TABLE_CELL, (cell) =>
    cell.includes('{') ? cell.replace(CENTRED_OR_RIGHT, '<w:jc w:val="left"/>') : cell,
  );
}

/** True when the request comes from the in-app preview (`?preview=1`), which keeps the marking. */
export function isDocxPreviewRequest(request: Request): boolean {
  return new URL(request.url).searchParams.get('preview') === '1';
}

/** Bytes for the response: marked for the preview, clean for a download. */
export function docxForResponse(docx: Buffer, preview: boolean): Buffer {
  return preview ? docx : stripDocxHighlights(docx);
}
