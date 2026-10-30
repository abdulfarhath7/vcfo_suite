import type { DocStageDef, DocStageRecords, DocTypeDef } from './types';

export type TrackState = 'done' | 'now' | 'next';

export interface TrackStep {
  key: string;
  label: string;
  state: TrackState;
  at?: string | null;
  by?: string | null;
}

/** Done = the step has a date. Now = the first open step. The rest are next. */
export function trackStates(stages: DocStageDef[], records: DocStageRecords): TrackStep[] {
  let nowSet = false;
  return stages.map((s) => {
    const r = records[s.key];
    if (r?.at) return { key: s.key, label: s.label, state: 'done' as const, at: r.at, by: r.by ?? null };
    const state: TrackState = nowSet ? 'next' : 'now';
    nowSet = true;
    return { key: s.key, label: s.label, state };
  });
}

/**
 * The "What you do" list from the same records. A line is done when its step is done, or when a
 * later track step is done (an accepted copy ticks every line). The first open line is now.
 */
export function todoStates(type: Pick<DocTypeDef, 'stages' | 'todo'>, records: DocStageRecords): Array<{ key: string; label: string; state: TrackState }> {
  const order = type.stages.map((s) => s.key);
  const lastDone = order.reduce((acc, k, i) => (records[k]?.at ? i : acc), -1);
  let nowSet = false;
  return type.todo.map((t) => {
    const idx = order.indexOf(t.stage);
    const done =
      Boolean(records[t.stage]?.at) ||
      (idx >= 0 ? lastDone > idx : lastDone === order.length - 1 && order.length > 0);
    if (done) return { key: t.key, label: t.label, state: 'done' as const };
    const state: TrackState = nowSet ? 'next' : 'now';
    nowSet = true;
    return { key: t.key, label: t.label, state };
  });
}
