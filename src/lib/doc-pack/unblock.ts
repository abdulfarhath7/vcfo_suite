import type { DocPackMissingInput, DocPackSummary } from '@/lib/doc-pack/types';

export interface UnblockHint {
  input: DocPackMissingInput;
  /** Documents that become ready once this input is filled (it was their only gap). */
  releases: number;
  /** Documents that list this input, released or not. */
  appearsIn: number;
}

/**
 * The single missing input worth filling next: the one that fully releases
 * the most documents, preferring inputs on the step the lead is already on.
 * Gates (BR finalize, directors accepted) are not inputs and are never hinted.
 */
export function fastestUnblock(summary: DocPackSummary, currentStepId?: string): UnblockHint | null {
  const tally = new Map<string, UnblockHint>();
  for (const item of summary.items) {
    if (item.status !== 'needs-inputs') continue;
    for (const missing of item.missing) {
      const hint = tally.get(missing.key) ?? { input: missing, releases: 0, appearsIn: 0 };
      hint.appearsIn += 1;
      if (item.missing.length === 1) hint.releases += 1;
      tally.set(missing.key, hint);
    }
  }
  if (tally.size === 0) return null;

  const byValue = (a: UnblockHint, b: UnblockHint) =>
    b.releases - a.releases || b.appearsIn - a.appearsIn || a.input.key.localeCompare(b.input.key);
  const all = [...tally.values()].sort(byValue);
  if (currentStepId) {
    const onStep = all.filter((h) => h.input.stepId === currentStepId);
    if (onStep.length > 0) return onStep[0]!;
  }
  return all[0]!;
}

/** "Director 2 · PAN" or "Registered office address". */
export function missingInputLabel(input: Pick<DocPackMissingInput, 'label' | 'directorIndex'>): string {
  return input.directorIndex !== undefined
    ? `Director ${input.directorIndex} · ${input.label}`
    : input.label;
}
