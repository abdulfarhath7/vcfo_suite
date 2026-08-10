'use client';

import { AlertTriangle } from 'lucide-react';
import type { IncorpDocPreviewError } from '@/lib/incorporation-docs/preview-errors';

export function IncorporationPreviewErrorPanel({
  error,
  previewLabel,
  downloadUrl,
  onRecover,
  recovering,
}: {
  error: IncorpDocPreviewError;
  previewLabel: string;
  downloadUrl?: string;
  onRecover?: (() => Promise<void>) | (() => void);
  recovering?: boolean;
}) {
  return (
    <div className="flex min-h-[220px] max-w-md flex-col items-start gap-3 p-8 text-left" role="alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">{previewLabel}</p>
          <p className="mt-1 text-[15px] font-medium text-ink">{error.title}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{error.message}</p>
          {error.steps.length > 0 && (
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-text-tertiary">
              {error.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error.kind === 'corrupt_xml' && onRecover && (
        <button
          type="button"
          onClick={() => void onRecover()}
          disabled={recovering}
          className="rounded border border-orange/40 bg-orange/10 px-2.5 py-1 text-[11px] font-medium text-orange-700 hover:bg-orange/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {recovering ? 'Re-generating…' : 'Re-generate this draft'}
        </button>
      )}
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-orange-700 underline-offset-2 hover:underline"
        >
          Download Word file instead
        </a>
      )}
    </div>
  );
}
