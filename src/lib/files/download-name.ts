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
    // Control characters are not allowed in a file name, so stripping them is the point here.
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
