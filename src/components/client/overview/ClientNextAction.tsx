'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientOverviewNextAction } from '@/lib/client-overview';

/**
 * Module 2 — "what do you need from me right now".
 *
 * The focal point of the page, so it leads with the step title rather than a
 * label about the step. A coloured left rail carries the state; there is no
 * eyebrow and no icon tile competing with the title.
 * The card never performs the step; it deep-links into the gated flowchart at
 * `?step=`, which re-checks the sequential gate before opening anything.
 */
export function ClientNextAction({
  nextAction,
}: {
  nextAction?: ClientOverviewNextAction;
}) {
  if (!nextAction) {
    return (
      <section className="surface relative overflow-hidden">
        <span className="absolute inset-y-0 left-0 w-1 bg-success" aria-hidden />
        <div className="px-4 pb-4 pl-5 pt-4">
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            Nothing needed from you
          </p>
          <p className="serif text-[1.25rem] leading-tight tracking-tight text-ink">
            You&rsquo;re all set — we&rsquo;re working on it
          </p>
        </div>
      </section>
    );
  }

  const correction = nextAction.needsCorrection;

  return (
    <section className="surface relative overflow-hidden">
      <span
        className={cn('absolute inset-y-0 left-0 w-1', correction ? 'bg-danger' : 'bg-primary')}
        aria-hidden
      />
      <div className="flex flex-col gap-3 px-4 pb-4 pl-5 pt-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[12.5px] font-semibold',
              correction ? 'text-danger-text' : 'text-muted-foreground',
            )}
          >
            {correction ? 'Corrections needed' : 'We need this from you'}
          </p>
          <h2 className="serif mt-0.5 text-[1.35rem] leading-tight tracking-tight text-ink">
            {nextAction.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {correction
              ? (nextAction.correctionNote ??
                'Your project lead asked for an update — open the step and resubmit.')
              : (nextAction.description ??
                'Open the step to fill in the details we need to move forward.')}
          </p>
          {nextAction.dueLabel && !correction && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              Typically takes {nextAction.dueLabel}
            </p>
          )}
        </div>

        {/* One CTA style in both moods: status colour stays in the rail, the
            icon chip, and the heading (§5), never in a full-width button fill. */}
        <Link
          href={nextAction.href}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-bold tracking-tight transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            'bg-primary text-primary-foreground hover:bg-primary-dark',
          )}
        >
          {correction ? 'Fix & resubmit' : 'Open this step'}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
