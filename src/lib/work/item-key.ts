/**
 * One text id per work item, shared by every table that keys a row to an item
 * (`work_sessions`, `work_checklist_items`, `time_blocks`, `item_window_requests`,
 * `client_messages`). The formats are listed in src/db/schema-work.ts.
 */
export type WorkItemRef =
  | { kind: 'step'; engagementId: string; stepId: string }
  | { kind: 'filing'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'request'; id: string }
  | { kind: 'task'; id: string };

export function itemKey(ref: WorkItemRef): string {
  if (ref.kind === 'step') return `step:${ref.engagementId}:${ref.stepId}`;
  return `${ref.kind}:${ref.id}`;
}

/** Parses a key built by `itemKey`; returns null for anything else. */
export function parseItemKey(key: string): WorkItemRef | null {
  const [kind, a, b] = key.split(':');
  if (kind === 'step') return a && b ? { kind, engagementId: a, stepId: b } : null;
  if ((kind === 'filing' || kind === 'event' || kind === 'request' || kind === 'task') && a && !b) {
    return { kind, id: a };
  }
  return null;
}
