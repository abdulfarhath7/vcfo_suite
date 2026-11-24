import { checklist, getActiveCatalogItems, getItem } from '@/data/checklist';

/**
 * The order a fill run works in. A review card's checklist rows are grouped by step, and the steps
 * are put in checklist order (the active catalog first, then any other catalog step), because a
 * step opens only after the one before it is complete. Pure, so the run, the routes and the tests
 * read one answer.
 */

/** The card actions a fill run writes. Every other row (vault, labour, compliance) stays on the card. */
export const FILL_ACTIONS: ReadonlySet<string> = new Set(['checklist.setResponse', 'checklist.attachFile']);

/** Row statuses that are gone from the run: put back, or left by the person. */
const GONE: ReadonlySet<string> = new Set(['undone', 'skipped']);

export interface FillPlanRow {
  id: string;
  action: string;
  target: Record<string, unknown>;
  status: string;
}

export interface FillPlanStep {
  stepId: string;
  title: string;
  /** The card rows for this step, in card order. Rows already saved are kept so the step still counts them. */
  rowIds: string[];
}

function orderIndex(): Map<string, number> {
  const order = new Map<string, number>();
  for (const item of getActiveCatalogItems()) if (!order.has(item.id)) order.set(item.id, order.size);
  for (const item of checklist) if (!order.has(item.id)) order.set(item.id, order.size);
  return order;
}

export function isFillRow(row: Pick<FillPlanRow, 'action' | 'target'>): boolean {
  return FILL_ACTIONS.has(row.action) && typeof row.target.stepId === 'string' && row.target.stepId.length > 0;
}

/** The steps of a card that hold checklist rows, in checklist order, with their titles. */
export function planFill(rows: readonly FillPlanRow[]): FillPlanStep[] {
  const order = orderIndex();
  const byStep = new Map<string, string[]>();
  for (const row of rows) {
    if (!isFillRow(row) || GONE.has(row.status)) continue;
    const stepId = String(row.target.stepId);
    if (!order.has(stepId)) continue;
    byStep.set(stepId, [...(byStep.get(stepId) ?? []), row.id]);
  }
  return [...byStep.entries()]
    .sort(([a], [b]) => order.get(a)! - order.get(b)!)
    .map(([stepId, rowIds]) => ({ stepId, title: getItem(stepId)?.title ?? stepId, rowIds }));
}
