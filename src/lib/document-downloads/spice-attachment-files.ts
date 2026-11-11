import type { PublicDownloadFile, PublicDownloadGroup } from '@/lib/document-downloads/catalog';
import { publicFilesIn } from '@/lib/document-downloads/selection';

/**
 * Which files of the download catalog belong to each row of the SPICe+ attachments card
 * (`src/lib/spice-attachments/derive.ts`), so a row can preview and download its own documents.
 * A row matches by catalog key prefix: generated documents by `pack:<docId>:`, uploads by
 * `upload:<step>:` (and the field, when a step holds other files too).
 */
const ROW_PREFIXES: Record<string, readonly string[]> = {
  'board-resolution': ['pack:board-resolution:', 'br-signed', 'upload:pre-3:'],
  'parent-proof': ['upload:pre-1:certificateOfIncorporationUrl'],
  'office-proof': ['upload:pre-14:'],
  'director-kyc': ['upload:pre-15:'],
  'dir-2': ['pack:dir-2:'],
  'inc-9': ['pack:inc-9:'],
  moa: ['pack:moa:'],
  aoa: ['pack:aoa:'],
};

export function filesForSpiceAttachment(rowKey: string, root: PublicDownloadGroup | null | undefined): PublicDownloadFile[] {
  const prefixes = ROW_PREFIXES[rowKey];
  if (!prefixes || !root) return [];
  return publicFilesIn(root).filter((f) => prefixes.some((p) => f.key === p || f.key.startsWith(p)));
}

/** Why a row's icons are off, for the tooltip; null when at least one file is ready. */
export function attachmentFilesUnavailableReason(files: readonly PublicDownloadFile[], rowDetail: string): string | null {
  if (files.some((f) => f.ready)) return null;
  const reason = files.find((f) => f.reason)?.reason;
  return `No file yet: ${reason ?? rowDetail}`;
}
