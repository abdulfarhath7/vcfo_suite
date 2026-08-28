'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Engagement } from '@/data/engagements';
import { fetchBoardResolutionInDb } from '@/lib/engagements-db';
import { internBoardResolutionPath } from '@/lib/project-step-path';
import { cn } from '@/lib/utils';

interface BoardResolutionStepLinkProps {
  engagement: Engagement;
  className?: string;
  /** Compact button (intern form footer) vs the overview card. */
  variant?: 'card' | 'button';
}

/** Intern-only CTA from Pre-2 step to draft/finalize board resolution. */
export function BoardResolutionStepLink({
  engagement,
  className,
  variant = 'card',
}: BoardResolutionStepLinkProps) {
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
          ? 'Not started'
          : null;

  if (variant === 'button') {
    return (
      <Button asChild size="sm" variant="outline" className={cn('cursor-pointer', className)}>
        <Link href={internBoardResolutionPath(engagement)}>{label}</Link>
      </Button>
    );
  }

  return (
    <Link
      href={internBoardResolutionPath(engagement)}
      className={cn(
        'flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3',
        'hover:border-blue-300 hover:bg-blue-100/80 transition-colors group',
        className,
      )}
    >
      <FileText className="w-5 h-5 text-blue-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink group-hover:text-blue-700">{label}</p>
      </div>
      {statusLabel && (
        <span
          className={cn(
            'shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            status === 'finalized'
              ? 'border-success/30 bg-success/10 text-success-text'
              : status === 'draft'
                ? 'border-blue-200 bg-blue-100 text-blue-700'
                : 'border-border bg-raised/60 text-text-tertiary',
          )}
        >
          {statusLabel}
        </span>
      )}
      {status === 'loading' && (
        <span className="text-[10px] text-text-tertiary mono">…</span>
      )}
    </Link>
  );
}
