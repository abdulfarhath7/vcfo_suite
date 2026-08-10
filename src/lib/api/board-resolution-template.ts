import {
  getBoardResolutionTemplateFingerprint,
  getBoardResolutionTemplateInfo,
  type BoardResolutionTemplateInfo,
} from '@/lib/board-resolution-docx';
import type { BoardResolutionDoc } from '@/lib/board-resolution';

export function boardResolutionTemplateInfo(): BoardResolutionTemplateInfo {
  return getBoardResolutionTemplateInfo();
}

export function boardResolutionTemplateFingerprint(): string {
  return getBoardResolutionTemplateFingerprint();
}

/** Parse Postgres / RPC ISO timestamps (incl. sub-millisecond fractions). */
export function parseBoardResolutionUpdatedAtMs(updatedAt: string | null | undefined): number | null {
  if (!updatedAt?.trim()) return null;

  const trimmed = updatedAt.trim();
  let ms = Date.parse(trimmed);
  if (Number.isFinite(ms)) return ms;

  // Normalize fractional seconds to milliseconds for engines that reject >3 digits.
  const normalized = trimmed.replace(
    /\.(\d+)(?=([+-]\d{2}:?\d{2}|Z)$)/,
    (_, fraction: string) => `.${fraction.slice(0, 3).padEnd(3, '0')}`,
  );
  ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

export function boardResolutionRootSourceNewerThanTemplate(
  info: Pick<BoardResolutionTemplateInfo, 'modifiedAtMs' | 'rootSourceModifiedAtMs'>,
): boolean {
  if (info.rootSourceModifiedAtMs == null) return false;
  return info.rootSourceModifiedAtMs > info.modifiedAtMs;
}

export function boardResolutionNeedsTemplateRefresh(
  doc:
    | Pick<
        BoardResolutionDoc,
        'status' | 'storagePath' | 'templateFingerprint' | 'updatedAt'
      >
    | null
    | undefined,
  currentFingerprint: string,
  templateModifiedAtMs?: number,
  options?: { rootSourceNewerThanTemplate?: boolean },
): boolean {
  if (!doc || doc.status === 'finalized') return false;
  if (!doc.storagePath?.trim()) return false;

  if (options?.rootSourceNewerThanTemplate) return true;

  const storedFingerprint = doc.templateFingerprint?.trim();
  if (!storedFingerprint) return true;
  if (storedFingerprint !== currentFingerprint) return true;

  if (templateModifiedAtMs != null) {
    const docUpdatedMs = parseBoardResolutionUpdatedAtMs(doc.updatedAt);
    if (docUpdatedMs != null && templateModifiedAtMs > docUpdatedMs) {
      return true;
    }
  }

  return false;
}
