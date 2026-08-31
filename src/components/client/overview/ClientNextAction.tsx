'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCheck, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientOverviewNextAction } from '@/lib/client-overview';

/**
 * Module 2 — "what do you need from me right now".
 *
 * The lead dashboard's action-queue language: `.surface`, a solid icon chip,
 * an extra-bold uppercase heading, and a coloured left rail carrying the state.
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
        <div className="flex min-w-0 items-center gap-2.5 px-4 pl-5 pt-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success text-white">
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">
            Nothing needed from you
          </h2>
        </div>
        <div className="px-4 pb-3.5 pl-5 pt-2">
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
      <div className="flex min-w-0 items-center gap-2.5 px-4 pl-5 pt-3">
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white',
            correction ? 'bg-danger' : 'bg-primary',
          )}
        >
          {correction ? (
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Zap className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
        <h2
          className={cn(
            'min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em]',
            correction ? 'text-danger-text' : 'text-ink',
          )}
        >
          {correction ? 'Corrections needed' : 'We need this from you'}
        </h2>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-3.5 pl-5 pt-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="serif text-[1.25rem] leading-tight tracking-tight text-ink">
            {nextAction.title}
          </p>
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
