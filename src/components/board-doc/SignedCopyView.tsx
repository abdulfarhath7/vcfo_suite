'use client';

import { useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FileBadge } from '@/components/ui/file-badge';
import { cn } from '@/lib/utils';
import { docDay } from './format';
import { signedKind } from './signed-kind';
import type { SignedCopy } from './types';

function sameOrigin(url: string): boolean {
  if (url.startsWith('/')) return true;
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * C6: the Signed copy tab. It shows the uploaded file as received and nothing else: no drawn
 * signature, no seal (P7). A same-origin route sends `attachment`, so the bytes are fetched once
 * and shown from a blob URL; a signed storage URL is shown as it is.
 */
export function SignedCopyView({
  file,
  onOpenFull,
  height = 560,
  className,
}: {
  file: SignedCopy | null;
  onOpenFull?: () => void;
  height?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const kind = file ? signedKind(file) : 'other';
  const urlKey = file ? (typeof file.url === 'string' ? file.url : `${file.name}:${file.uploadedAt ?? ''}`) : '';

  useEffect(() => {
    if (!file || kind === 'other') return;
    let objectUrl: string | null = null;
    let live = true;
    setSrc(null);
    setFailed(false);
    (async () => {
      try {
        const url = typeof file.url === 'string' ? file.url : await file.url();
        if (!sameOrigin(url)) {
          if (live) setSrc(url);
          return;
        }
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(kind === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob);
        if (live) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // The URL key stands for the file; a new upload gives a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey, kind]);

  if (!file) return <EmptyState title="No signed copy yet" className={cn('m-4', className)} />;

  const meta = [file.uploadedBy, docDay(file.uploadedAt)].filter(Boolean).join(' · ');
  const head = (
    <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5">
      <FileBadge name={file.name} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13px] font-medium text-ink">Signed copy</b>
        {meta ? <span className="block truncate text-[12px] text-ink-muted">Uploaded · {meta}</span> : null}
      </span>
      {onOpenFull ? (
        <Button size="iconSm" variant="quiet" aria-label="Open the signed copy full screen" onClick={onOpenFull}>
          <Maximize2 strokeWidth={1.6} aria-hidden />
        </Button>
      ) : null}
    </div>
  );

  let body;
  if (kind === 'other') {
    body = (
      <EmptyState
        className="m-4"
        title="This file type does not show here"
        action={
          onOpenFull ? (
            <Button variant="secondary" size="sm" onClick={onOpenFull}>
              Open
            </Button>
          ) : undefined
        }
      />
    );
  } else if (failed) {
    body = <EmptyState className="m-4" title="The signed copy did not load" action={onOpenFull ? <Button variant="secondary" size="sm" onClick={onOpenFull}>Open</Button> : undefined} />;
  } else if (!src) {
    body = <div aria-busy="true" className="m-4 animate-pulse rounded-md bg-surface-sunken" style={{ height: Math.min(height, 320) }} />;
  } else if (kind === 'pdf') {
    body = <iframe title={`Signed copy · ${file.name}`} src={`${src}#toolbar=0&navpanes=0&view=FitH`} className="block w-full border-0 bg-surface-sunken" style={{ height: `min(${height}px, 75vh)` }} />;
  } else {
    // eslint-disable-next-line @next/next/no-img-element -- a blob or signed URL, not a static asset.
    body = <img src={src} alt={`Signed copy · ${file.name}`} className="mx-auto block max-h-[75vh] max-w-full object-contain p-4" />;
  }

  return (
    <div className={className} data-signed-copy="">
      {head}
      {body}
    </div>
  );
}
