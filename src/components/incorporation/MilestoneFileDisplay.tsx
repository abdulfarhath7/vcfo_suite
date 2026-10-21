'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  getMilestoneDocumentSignedUrl,
  fileNameFromStoragePath,
} from '@/lib/documents/milestone-document-storage';

interface MilestoneFileDisplayProps {
  storagePath: string;
  label: string;
  /** 'inline' = small text link (default). 'card' = used in form upload preview. */
  variant?: 'inline' | 'card';
}

export function MilestoneFileDisplay({
  storagePath,
  label,
  variant = 'inline',
}: MilestoneFileDisplayProps) {
  const [href, setHref] = useState<string | null>(null);
  const name = fileNameFromStoragePath(storagePath) || label;

  useEffect(() => {
    let cancelled = false;
    if (!storagePath.trim()) return;
    void getMilestoneDocumentSignedUrl(storagePath).then((url) => {
      if (!cancelled) setHref(url);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (!href) return <span className="text-sm text-ink-muted">{name}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === 'card'
          ? 'inline-flex max-w-full items-center gap-1 truncate text-xs text-blue-700 underline-offset-2 hover:underline'
          : 'inline-flex items-center gap-1.5 text-sm text-brand underline-offset-2 hover:underline'
      }
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {name}
    </a>
  );
}
