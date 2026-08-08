'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  fileNameFromStoragePath,
  getMilestoneDocumentSignedUrl,
} from '@/lib/milestone-document-storage';
import { cn } from '@/lib/utils';

interface MilestoneDocumentLinkProps {
  storagePath: string;
  label?: string;
  className?: string;
  variant?: 'admin' | 'client';
}

function MilestoneDocumentLinkInner({
  storagePath,
  label,
  className,
  variant = 'admin',
}: MilestoneDocumentLinkProps) {
  const [href, setHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isClient = variant === 'client';

  useEffect(() => {
    let cancelled = false;
    void getMilestoneDocumentSignedUrl(storagePath).then((url) => {
      if (!cancelled) {
        setHref(url);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const name = fileNameFromStoragePath(storagePath);
  const display = name || label || 'Document';

  if (loading) {
    return (
      <span className={cn('text-sm italic text-text-tertiary', className)}>
        Loading…
      </span>
    );
  }

  if (!href) {
    return (
      <span className={cn('text-sm text-text-tertiary', className)}>
        {display} (link unavailable)
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-sm underline-offset-2 hover:underline',
        isClient ? 'text-orange-700' : 'text-brand',
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {display}
    </a>
  );
}

export function MilestoneDocumentLink(props: MilestoneDocumentLinkProps) {
  const name = fileNameFromStoragePath(props.storagePath);
  const display = name || props.label || 'Document';

  if (!props.storagePath.trim()) {
    return (
      <span className={cn('text-sm text-text-tertiary', props.className)}>
        {display} (link unavailable)
      </span>
    );
  }

  return <MilestoneDocumentLinkInner key={props.storagePath} {...props} />;
}
