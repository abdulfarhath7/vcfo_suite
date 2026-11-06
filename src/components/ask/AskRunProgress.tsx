'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { undoAskRunStep } from '@/hooks/ask/ask-api';
import type { AskRunView } from '@/lib/ask/agent/view';
import { AskChangesetCard } from './AskChangesetCard';

/**
 * An agent run in the chat: each step as it happens, a card when one needs a decision, and the run's
 * last word. The server keeps working with the page closed, and this picks up again on reopening.
 */
const WORKING: ReadonlySet<string> = new Set(['queued', 'running']);

export function AskRunProgress({ runId, shownLine }: { runId: string; shownLine: string }) {
  const [view, setView] = useState<AskRunView | null>(null);
  const undo = useMutation({ mutationFn: (stepId: string) => undoAskRunStep(runId, stepId), onSuccess: setView });

  useEffect(() => {
    const source = new EventSource(`/api/ask/runs/${encodeURIComponent(runId)}`);
    source.onmessage = (event) => setView(JSON.parse(event.data) as AskRunView);
    source.addEventListener('end', () => source.close());
    return () => source.close();
  }, [runId]);

  if (!view) return null;
  return (
    <div className="space-y-2" data-testid="run-progress">
      {view.steps.length > 0 ? (
        <ul className="space-y-1">
          {view.steps.map((step) =>
            step.changesetId ? (
              <li key={step.id}>
                <AskChangesetCard changesetId={step.changesetId} />
              </li>
            ) : (
              <li key={step.id} className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">
                <span>{step.status === 'failed' ? `${step.label}: could not be done` : step.status === 'undone' ? `${step.label}: undone` : step.label}</span>
                {step.undoable ? (
                  <Button type="button" size="sm" variant="ghost" disabled={undo.isPending} onClick={() => undo.mutate(step.id)}>
                    Undo
                  </Button>
                ) : null}
              </li>
            ),
          )}
        </ul>
      ) : null}
      <div aria-live="polite">
        {WORKING.has(view.status) ? (
          <p className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2 text-[12.5px] font-medium text-ink">
            <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-[2px] bg-brand" aria-hidden />
            Working…
          </p>
        ) : null}
        {view.status === 'waiting_approval' ? <p className="text-[12.5px] text-ink-muted">Waiting for a decision on the card.</p> : null}
        {view.line && view.line !== shownLine ? <p className="text-[13px] text-ink">{view.line}</p> : null}
      </div>
      {undo.error ? (
        <p role="alert" className="text-[12px] text-danger">
          {(undo.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}
