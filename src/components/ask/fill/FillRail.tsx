'use client';

import { AnimatePresence, m } from 'framer-motion';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FillRunView } from '@/lib/ask/fill/types';
import { fillActions, useFillState, type FillState } from './fill-store';

type StepView = FillRunView['steps'][number];

const PHASE_LINE: Partial<Record<FillState['phase'], string>> = {
  loading: 'Getting the fill ready',
  typing: 'Filling the page',
  waiting: 'Check the page, change anything you like, then accept it',
  saving: 'Saving and submitting the page',
  auto: 'Filling and saving each step',
  done: 'Every step is filled',
  stopped: 'Stopped. Done steps stay saved; the card keeps the rest.',
};

function StepMark({ status }: { status: StepView['status'] }) {
  if (status === 'done')
    return (
      <m.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-4 w-4 flex-none place-items-center rounded-full bg-positive-soft text-positive">
        <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
      </m.span>
    );
  if (status === 'stopped')
    return <AlertCircle className="h-4 w-4 flex-none text-warning" strokeWidth={1.8} aria-hidden />;
  if (status === 'active')
    return (
      <span className="relative grid h-4 w-4 flex-none place-items-center" aria-hidden>
        <m.span layoutId="ask-fill-active-dot" className="h-2 w-2 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
        <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-brand/25" />
      </span>
    );
  return <span className="h-4 w-4 flex-none rounded-full border-1.5 border-line-strong" aria-hidden />;
}

const STATUS_WORD: Record<StepView['status'], string> = {
  done: 'done',
  active: 'in progress',
  pending: 'waiting',
  stopped: 'stopped',
};

/**
 * The fill's rail in the Ask thread: each step done, active (pulsing), waiting or stopped with
 * its reason, the live count, and Accept page / Stop while Manual waits on the person.
 */
export function FillRail() {
  const fill = useFillState();
  if (!fill) return null;
  const { view, phase, mode, typed } = fill;
  const actions = fillActions();
  const busy = phase === 'loading' || phase === 'opening' || phase === 'typing' || phase === 'saving' || phase === 'auto';
  const finished = phase === 'done' || phase === 'stopped' || Boolean(actions.dismiss);
  const line = fill.message ?? PHASE_LINE[phase] ?? '';

  return (
    <m.section
      data-testid="ask-fill-rail"
      aria-label="Fill into app"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2 rounded-md bg-surface-sunken px-3 py-2.5 text-[12.5px] text-ink"
    >
      <p className="flex items-center gap-2 font-medium">
        <span className="min-w-0 flex-1 truncate">
          Filling {view?.companyName ?? 'the project'}
        </span>
        <span className="flex-none rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-line">
          {mode === 'auto' ? 'Auto' : 'Manual'}
        </span>
      </p>

      {view ? (
        <ol className="space-y-1">
          {view.steps.map((step) => {
            const live = step.status === 'active' ? Math.max(step.filled, typed[step.stepId] ?? 0) : step.filled;
            return (
              <m.li key={step.stepId} layout="position" className="flex min-w-0 items-start gap-2">
                <span className="pt-px">
                  <StepMark status={step.status} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', step.status === 'pending' ? 'text-ink-muted' : 'text-ink', step.status === 'active' && 'font-medium')}>
                    {step.title}
                    <span className="sr-only">, {STATUS_WORD[step.status]}</span>
                  </span>
                  {step.status === 'stopped' && step.stopReason ? (
                    <span className="block text-[11.5px] text-warning">{step.stopReason}</span>
                  ) : null}
                </span>
                {step.total > 0 ? (
                  <span className="flex-none font-mono text-[11.5px] tabular-nums text-ink-muted">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.span key={live} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 4, opacity: 0 }} className="inline-block">
                        {Math.min(live, step.total)}
                      </m.span>
                    </AnimatePresence>
                    /{step.total}
                  </span>
                ) : null}
              </m.li>
            );
          })}
        </ol>
      ) : null}

      {line ? (
        <p aria-live="polite" className={cn('flex items-center gap-1.5 text-[12px]', phase === 'error' ? 'text-danger' : 'text-ink-muted')}>
          {busy ? <Loader2 className="h-3 w-3 flex-none animate-spin" aria-hidden /> : null}
          {line}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {phase === 'waiting' ? (
          <Button type="button" size="sm" variant="soft" onClick={() => actions.accept?.()}>
            Accept page
          </Button>
        ) : null}
        {phase === 'error' && actions.retry ? (
          <Button type="button" size="sm" variant="outline" onClick={() => actions.retry?.()}>
            Try again
          </Button>
        ) : null}
        {!finished ? (
          <Button type="button" size="sm" variant="quiet" disabled={phase === 'saving'} onClick={() => actions.stop?.()}>
            Stop
          </Button>
        ) : (
          <Button type="button" size="sm" variant="quiet" onClick={() => actions.dismiss?.()}>
            Close
          </Button>
        )}
      </div>
    </m.section>
  );
}
