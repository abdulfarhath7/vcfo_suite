import type { WorkItemRef } from '@/lib/work/item-key';

/**
 * Activity for one work item (task drawer, G-16). Audit events name the item in their
 * metadata in a few ways, depending on the writer: `itemKey` (work tools), `itemId` or
 * `stepId` (checklist writes), `target.itemId` (step windows), `instanceId` (filing
 * windows and proofs) and `requestId` (document requests). Activity rows carry only a
 * message, so they match on the item's label.
 */
export interface WorkActivityEntry {
  id: string;
  at: string;
  who: string;
  text: string;
  source: 'audit' | 'activity';
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function auditEventMatchesItem(
  metadata: Record<string, unknown> | null | undefined,
  ref: WorkItemRef,
  key: string,
): boolean {
  if (!metadata) return false;
  if (str(metadata.itemKey) === key) return true;
  if (ref.kind === 'step') {
    if (str(metadata.itemId) === ref.stepId || str(metadata.stepId) === ref.stepId) return true;
    const target = metadata.target;
    if (target && typeof target === 'object' && str((target as Record<string, unknown>).itemId) === ref.stepId) {
      return true;
    }
    return false;
  }
  if (ref.kind === 'filing' || ref.kind === 'event') return str(metadata.instanceId) === ref.id;
  if (ref.kind === 'request') return str(metadata.requestId) === ref.id;
  return str(metadata.taskId) === ref.id;
}

/** An activity row belongs to the item when its message is the item's label. */
export function activityMatchesItem(message: string | null | undefined, labels: readonly string[]): boolean {
  const text = message?.trim().toLowerCase();
  if (!text) return false;
  return labels.some((label) => label.trim() && text === label.trim().toLowerCase());
}

/** Newest first, at most `limit` entries. */
export function mergeActivity(entries: WorkActivityEntry[], limit = 30): WorkActivityEntry[] {
  return [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}
