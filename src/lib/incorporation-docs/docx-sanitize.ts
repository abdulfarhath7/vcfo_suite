import PizZip from 'pizzip';

import { dedupeXmlAttributes } from '@/lib/board-resolution-docx-body';

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
