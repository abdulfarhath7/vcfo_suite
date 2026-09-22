import type { DocPackItem, DocPackSummary, DocStatus } from '@/lib/doc-pack/types';

export interface StepDocsSummary {
  items: DocPackItem[];
  counts: Record<DocStatus, number>;
  total: number;
}

/** Documents whose inputs come from this step, for the strip at the top of the form. */
export function docsFedByStep(summary: DocPackSummary, stepId: string): StepDocsSummary {
  const items = summary.items.filter((item) => item.sourceStepIds.includes(stepId));
  const counts: Record<DocStatus, number> = { ready: 0, 'needs-inputs': 0, 'waiting-release': 0 };
  for (const item of items) counts[item.status] += 1;
  return { items, counts, total: items.length };
}
