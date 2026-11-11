import type { ViewerDoc } from '@/components/client-portal/pages/documents/DocViewer';
import type { PublicDownloadFile, PublicDownloadGroup } from '@/lib/document-downloads/catalog';

/**
 * Browser side of the document downloads (the pop-up, the SPICe+ attachments card): the API
 * paths, one download call for any set of keys, and the documents in the shape of the shared
 * viewer (`DocViewer`).
 */

export type DownloadCatalogDto = { companyName: string; root: PublicDownloadGroup };
export type DownloadLayout = 'folders' | 'flat';

export function documentDownloadsPath(engagementId: string): string {
  return `/api/engagements/${encodeURIComponent(engagementId)}/document-downloads`;
}

/** One document from our own origin: inline for preview, or `download` for an attachment. */
export function documentFileUrl(engagementId: string, key: string, download = false): string {
  return `${documentDownloadsPath(engagementId)}/file?key=${encodeURIComponent(key)}${download ? '&download=1' : ''}`;
}

function fileNameFrom(disposition: string | null, fallback: string): string {
  const star = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (star) return decodeURIComponent(star);
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Download the documents with these keys. One key comes back as the file itself, a small set as a
 * ZIP, a large set is made in the background (`{ queued: true }`, the bell gives the link).
 * Throws with the server's message when nothing could be downloaded.
 */
export async function downloadDocumentKeys(
  engagementId: string,
  keys: readonly string[],
  layout: DownloadLayout = 'folders',
): Promise<{ queued: boolean; fileName?: string }> {
  const res = await fetch(documentDownloadsPath(engagementId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ keys, layout }),
  });
  if (res.status === 202) {
    const out = (await res.json().catch(() => ({}))) as { fileName?: string };
    return { queued: true, fileName: out.fileName };
  }
  if (!res.ok) {
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(out.error || 'The download did not start.');
  }
  const fileName = fileNameFrom(res.headers.get('content-disposition'), 'Documents.zip');
  saveBlob(await res.blob(), fileName);
  return { queued: false, fileName };
}

/** Ready catalog files as documents for the shared viewer: preview inline, download as attachment. */
export function catalogViewerDocs(engagementId: string, files: readonly PublicDownloadFile[]): ViewerDoc[] {
  return files
    .filter((f) => f.ready)
    .map((f) => ({
      id: f.key,
      name: f.fileName,
      meta: f.label,
      url: async () => documentFileUrl(engagementId, f.key),
      downloadUrl: async () => documentFileUrl(engagementId, f.key, true),
    }));
}
