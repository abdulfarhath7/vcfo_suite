'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Engagement } from '@/data/engagements';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import { boardResolutionPathFor } from '@/lib/projects/project-step-path';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { Chip } from '@/components/ui/spectrum-chip';
import { FileBadge } from '@/components/ui/file-badge';

interface BoardResolutionStepLinkProps {
  engagement: Engagement;
  className?: string;
  /** Compact button (intern form footer) vs the overview card. */
  variant?: 'card' | 'button';
}

/**
 * The link from the Pre-2 step into the board resolution page. The lead drafts and finalizes
 * there; a manager, an admin and the super admin open the same editor in their own shell.
 */
export function BoardResolutionStepLink({
  engagement,
  className,
  variant = 'card',
}: BoardResolutionStepLinkProps) {
  const { user } = useApp();
  const href = boardResolutionPathFor(user?.role, engagement, usePathname());
  const fetchKey = `${engagement.id}:1`;
  const fetchScopeRef = useRef(fetchKey);
  const [status, setStatus] = useState<'draft' | 'finalized' | 'none' | 'loading'>('loading');

  if (fetchKey !== fetchScopeRef.current) {
    fetchScopeRef.current = fetchKey;
    setStatus('loading');
  }

  useEffect(() => {
    let cancelled = false;
    void fetchBoardResolutionInDb(engagement.id)
      .then((doc) => {
        if (cancelled) return;
        if (!doc) setStatus('none');
        else if (doc.status === 'finalized') setStatus('finalized');
        else setStatus('draft');
      })
      .catch(() => {
        if (!cancelled) setStatus('none');
      });
    return () => {
      cancelled = true;
    };
  }, [engagement.id]);

  const label =
    status === 'finalized'
      ? 'Board resolution finalized — shared with client'
      : status === 'draft'
        ? 'Draft generated — continue editing and finalize'
        : 'Generate draft board resolution';

  const statusLabel =
    status === 'finalized'
      ? 'Shared with client'
      : status === 'draft'
        ? 'Draft saved'
        : status === 'none'
          ? // The step can be done by hand without a draft made here, so say what is missing, not "Not started".
            'Not generated'
          : null;

  if (variant === 'button') {
    return (
      <Button asChild size="sm" variant="outline" className={cn('cursor-pointer', className)}>
        <Link href={href}>{label}</Link>
      </Button>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border-1.5 border-line bg-surface-raised px-3 py-2',
        'transition-colors hover:border-line-strong hover:bg-surface-sunken/60',
        className,
      )}
    >
      <FileBadge type="DOCX" />
      <div className="min-w-[9rem] flex-1">
        <p className="text-[14px] font-medium text-ink group-hover:underline">{label}</p>
      </div>
      {statusLabel && (
        <Chip tone={status === 'finalized' ? 'ok' : status === 'draft' ? 'prog' : 'idle'} className="shrink-0">
          {statusLabel}
        </Chip>
      )}
      {status === 'loading' && (
        <span className="text-[12px] text-ink-faint">…</span>
      )}
    </Link>
  );
}
