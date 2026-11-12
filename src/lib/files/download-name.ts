import { properNameCase } from '@/lib/names/name-casing';

/**
 * The name of every file the app gives for download (GL-08):
 *
 *   <DocumentName>_<ClientName>_<DD-MM-YYYY>.<ext>
 *   Board-Resolution_Ember-Technologies-Private-Limited_11-11-2026.docx
 *
 * Spaces become hyphens, the characters Windows refuses in a file name are dropped, the client
 * name has correct capital letters (GL-09), and the date is the day of the download in Indian
 * Standard Time. Every download route and every file inside a ZIP calls this one function.
 */

/** One part of the name: hyphens for spaces, only characters every file system accepts. */
export function fileNamePart(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Control characters are not allowed in a file name on Windows, so they are removed on purpose.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/[^A-Za-z0-9.()&+-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
}

/** The download date, DD-MM-YYYY, in Indian Standard Time. */
export function downloadDateStamp(on: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })
    .formatToParts(on)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.day}-${parts.month}-${parts.year}`;
}

export function standardDownloadName(
  documentName: string,
  clientName: string | null | undefined,
  ext: string,
  on: Date = new Date(),
): string {
  const doc = fileNamePart(documentName) || 'Document';
  const client = fileNamePart(properNameCase(clientName));
  const extension = ext.replace(/^\.+/, '').toLowerCase();
  return `${[doc, client, downloadDateStamp(on)].filter(Boolean).join('_')}.${extension}`;
}

const STANDARD_TAIL = /_\d{2}-\d{2}-\d{4}\.[a-z0-9]+$/;

/**
 * The standard name for a file that already has a name: an uploaded file inside a ZIP, or a list
 * export the browser saves. Its own name without the extension becomes the document name, so
 * `PAN card.pdf` of Ember is `PAN-card_Ember_11-11-2026.pdf`. A name that already follows the
 * pattern is returned as it is, so a helper may pass every name through this safely.
 */
export function standardNameFromFile(fileName: string, clientName?: string | null, on: Date = new Date()): string {
  const base = fileName.split(/[/\\]/).pop() ?? '';
  if (STANDARD_TAIL.test(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1) : 'bin';
  return standardDownloadName(stem || 'File', clientName, ext, on);
}

/** A `YYYY-MM-DD` day in India as a moment on that day, for callers that already hold the IST day. */
export function istDay(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00+05:30`) : new Date();
}

/** A `Content-Disposition` value: the ASCII name, plus the UTF-8 name for browsers that read it. */
export function attachmentDisposition(fileName: string, kind: 'attachment' | 'inline' = 'attachment'): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
