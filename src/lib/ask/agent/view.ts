import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getOwnAskRun } from '@/db/repositories/ask-runs';

/** What the chat shows of a run: the steps a person cares about, and how it ended. Never its transcript. */
export interface AskRunStepView {
  id: string;
  label: string;
  status: string;
  changesetId: string | null;
  undoable: boolean;
}

export interface AskRunView {
  id: string;
  status: string;
  /** The stored answer, which the run's last word replaces. */
  line: string | null;
  steps: AskRunStepView[];
}

export const RUN_ENDED: ReadonlySet<string> = new Set(['done', 'failed', 'cancelled', 'over_budget']);

export async function loadAskRunView(ctx: AuthContext, runId: string): Promise<AskRunView | null> {
  const found = await getOwnAskRun(ctx, runId);
  if (!found) return null;
  const steps = found.steps
    .filter((step) => step.kind === 'tool' || step.kind === 'approval')
    .map((step) => ({
      id: step.id,
      label: step.label ?? step.name,
      status: step.status,
      changesetId: step.changesetId,
      undoable: step.status === 'done' && (step.output as { undo?: unknown } | null)?.undo != null,
    }));
  return { id: found.run.id, status: found.run.status, line: RUN_ENDED.has(found.run.status) ? found.line : null, steps };
}
