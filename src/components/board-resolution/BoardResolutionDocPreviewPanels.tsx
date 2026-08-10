'use client';

import { AlertTriangle } from 'lucide-react';
import type { BoardResolutionPreviewError } from '@/lib/board-resolution-preview-errors';

export type BoardResolutionDocPreviewMeta = {
  storagePath?: string | null;
  templateFingerprint?: string | null;
  updatedAt?: string | null;
  status?: string | null;
};

export function BoardResolutionPreviewErrorPanel({
  error,
  previewLabel,
  docMeta,
  downloadUrl,
}: {
  error: BoardResolutionPreviewError;
  previewLabel: string;
  docMeta?: BoardResolutionDocPreviewMeta;
  downloadUrl?: string;
}) {
  const showMeta =
    docMeta &&
    (docMeta.storagePath?.trim() ||
      docMeta.templateFingerprint?.trim() ||
      docMeta.updatedAt?.trim());

  return (
    <div
      className="flex min-h-[220px] max-w-md flex-col items-start gap-3 p-8 text-left"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">
            {previewLabel}
          </p>
          <p className="mt-1 text-[15px] font-medium text-ink">{error.title}</p>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-text-secondary">{error.message}</p>

      {error.steps.length > 0 && (
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-text-secondary">
          {error.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}

      {error.downloadMayWork && downloadUrl && (
        <p className="text-[12px] text-text-tertiary">
          Download Word document (below) may still work if Microsoft Word can open the file.
        </p>
      )}

      {error.kind === 'corrupt_xml' && (
        <p className="text-[12px] text-text-tertiary">
          Client-uploaded signed copies are stored separately and are not affected by this draft
          preview issue.
        </p>
      )}

      {showMeta && (
        <details className="w-full text-[11px] text-text-tertiary">
          <summary className="cursor-pointer font-medium text-text-secondary hover:text-ink">
            Storage details
          </summary>
          <dl className="mt-2 space-y-1 font-mono break-all">
            {docMeta.status?.trim() && (
              <>
                <dt className="text-text-tertiary">Status</dt>
                <dd>{docMeta.status}</dd>
              </>
            )}
            {docMeta.storagePath?.trim() && (
              <>
                <dt className="text-text-tertiary">Storage path</dt>
                <dd>{docMeta.storagePath}</dd>
              </>
            )}
            {docMeta.templateFingerprint?.trim() && (
              <>
                <dt className="text-text-tertiary">Template fingerprint</dt>
                <dd>{docMeta.templateFingerprint}</dd>
              </>
            )}
            {docMeta.updatedAt?.trim() && (
              <>
                <dt className="text-text-tertiary">Last updated</dt>
                <dd>{docMeta.updatedAt}</dd>
              </>
            )}
          </dl>
        </details>
      )}

      {error.technicalDetail && process.env.NODE_ENV === 'development' && (
        <p className="w-full font-mono text-[10px] text-text-tertiary break-all">
          {error.technicalDetail}
        </p>
      )}
    </div>
  );
}
