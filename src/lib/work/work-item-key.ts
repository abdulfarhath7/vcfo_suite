import { itemKey } from '@/lib/work/item-key';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';

/**
 * The stored item key for one row of the lead's Work list. Steps, document requests
 * and tasks carry their ids; a filing in Work is computed in the browser and keyed by
 * `${engagementId}:${obligationId}:${dueDate}:${periodLabel}`, so it needs the register
 * row (the compliance instance) to find its id. Returns null when the filing has no
 * register row yet; the drawer then hides the per-item tools.
 */
export function workItemKeyFor(
  item: {
    source: 'step' | 'filing' | 'request' | 'task';
    engagementId: string;
    catalogId?: string;
    filingId?: string;
    requestId?: string;
    taskId?: string;
  },
  filingInstanceIds: Readonly<Record<string, string>> = {},
): string | null {
  if (item.source === 'step') {
    return item.catalogId
      ? itemKey({ kind: 'step', engagementId: engagementDbId(item.engagementId), stepId: item.catalogId })
      : null;
  }
  if (item.source === 'request') return item.requestId ? itemKey({ kind: 'request', id: item.requestId }) : null;
  if (item.source === 'task') return item.taskId ? itemKey({ kind: 'task', id: item.taskId }) : null;
  const instanceId = item.filingId ? filingInstanceIds[item.filingId] : undefined;
  return instanceId ? itemKey({ kind: 'filing', id: instanceId }) : null;
}

/** Map the client-side filing id to the compliance instance id, from register rows. */
export function filingInstanceIdMap(
  rows: ReadonlyArray<{ id: string; engagementId: string; obligationId: string; dueDate: string; periodLabel: string | null }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    out[`${row.engagementId}:${row.obligationId}:${row.dueDate}:${row.periodLabel ?? ''}`] = row.id;
  }
  return out;
}
