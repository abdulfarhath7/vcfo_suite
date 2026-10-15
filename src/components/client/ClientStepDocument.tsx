'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import {
  fileNameFromStoragePath,
  getMilestoneDocumentSignedUrl,
} from '@/lib/milestone-document-storage';
import { clientBoardResolutionPath } from '@/lib/project-step-path';

function fileKind(path: string): 'pdf' | 'image' | 'other' {
  if (/\.pdf($|\?)/i.test(path)) return 'pdf';
  if (/\.(png|jpe?g|webp|gif)($|\?)/i.test(path)) return 'image';
  return 'other';
}

/**
 * The document the client is reading on a board-resolution step. It fills the
 * space under the record so approval sits on the paper, not in an empty page.
 */
export function ClientStepDocument({
  engagementId,
  itemId,
  storagePath,
  footer,
}: {
  engagementId: string;
  itemId: string;
  storagePath?: string;
  footer?: ReactNode;
}) {
  const path = storagePath?.trim() ?? '';
  const kind = path ? fileKind(path) : 'other';
  const [href, setHref] = useState<string | null>(null);
  const name = path ? fileNameFromStoragePath(path) : '';
  const draft = itemId === 'pre-2';

  useEffect(() => {
    if (!path || draft) return;
    let cancelled = false;
    void getMilestoneDocumentSignedUrl(path).then((url) => {
      if (!cancelled) setHref(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path, draft]);

  return (
    <section className="mt-3 flex flex-col overflow-hidden border border-border bg-panel">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <p className="text-[12.5px] font-semibold text-foreground">
          {draft ? 'Draft board resolution' : 'Signed copy'}
        </p>
        {name ? (
          <p className="min-w-0 flex-1 truncate text-right text-[12px] text-muted-foreground">{name}</p>
        ) : (
          <p className="min-w-0 flex-1 truncate text-right text-[12px] text-muted-foreground">
            {draft ? 'Word document' : 'PDF or Word'}
          </p>
        )}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : draft ? (
          <Link
            href={clientBoardResolutionPath()}
            className="shrink-0 text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
          >
            Open full document
          </Link>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 bg-muted/40 px-4 py-4 sm:px-8 sm:py-6">
        {draft ? (
          <BoardResolutionDocPreview
            engagementId={engagementId}
            previewLabel="Draft Word document"
            className="mx-auto"
          />
        ) : href && kind === 'pdf' ? (
          <iframe
            title={name || 'Signed board resolution'}
            src={href}
            className="mx-auto block h-[min(64vh,760px)] w-full max-w-[820px] border border-border bg-white"
          />
        ) : href && kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt={name || 'Signed board resolution'}
            className="mx-auto max-h-full max-w-[820px] border border-border bg-white"
          />
        ) : path && !href ? (
          <div className="mx-auto flex h-[min(64vh,760px)] max-w-[820px] items-center justify-center border border-border bg-white text-[13px] text-muted-foreground">
            Opening the signed copy…
          </div>
        ) : (
          <div className="mx-auto flex h-full min-h-[320px] max-w-[820px] flex-col justify-center border border-border bg-panel px-8 py-10">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-[15px] font-semibold text-foreground">
              {path ? 'The file is on this step' : 'The signed copy is not on this step yet'}
            </p>
            <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
              {path
                ? 'Open it from the link above. PDF and image copies also show on this page.'
                : 'Your team releases the draft. You sign it on letterhead and the signed copy is filed here for approval.'}
            </p>
            {!path ? (
              <ol className="mt-5 space-y-2 text-[13px] text-foreground">
                <li>1. Read the draft board resolution.</li>
                <li>2. Sign it on the parent company’s letterhead.</li>
                <li>3. The signed file and your remarks stay on this step.</li>
              </ol>
            ) : null}
          </div>
        )}
      </div>

      {footer ? <div className="border-t border-border px-4 py-2.5">{footer}</div> : null}
    </section>
  );
}
