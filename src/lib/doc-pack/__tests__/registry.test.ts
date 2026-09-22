import { describe, expect, it } from 'vitest';

import { checklist, getItem } from '@/data/checklist';
import { getClientResponseFields } from '@/lib/checklist-responses';
import { partAsectionsFor } from '@/lib/part-a-sections';
import { INCORP_DOC_KINDS } from '@/lib/incorporation-docs/types';
import { buildDocPackContext } from '@/lib/doc-pack/evaluate';
import { DOC_PACK_REGISTRY } from '@/lib/doc-pack/registry';
import { sectionSlug } from '@/lib/doc-pack/section-slug';
import type { RequiredInput } from '@/lib/doc-pack/types';
import { FINALIZED_BR, director, fullState } from '@/lib/doc-pack/__tests__/fixtures';

/** Every input the registry can ever emit, for a two-director engagement. */
function allInputs(): RequiredInput[] {
  const ctx = buildDocPackContext({
    state: fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')]),
    brRow: FINALIZED_BR,
  });
  const out: RequiredInput[] = [];
  for (const def of DOC_PACK_REGISTRY) {
    if (def.expandsPer === 'director') {
      for (const d of ctx.directors) out.push(...def.requiredInputs(ctx, d));
    } else {
      out.push(...def.requiredInputs(ctx));
    }
  }
  return out;
}

/** Section slugs a step can render, across every ownership variant. */
function sectionSlugsFor(stepId: string): Set<string> {
  const item = getItem(stepId);
  if (!item) return new Set();
  const slugs = new Set<string>();
  if (stepId === 'pre-1') {
    for (const ownership of [undefined, 'independent'] as const) {
      for (const section of partAsectionsFor(ownership)) slugs.add(sectionSlug(section));
    }
  }
  for (const field of getClientResponseFields(item)) {
    if (field.section) slugs.add(sectionSlug(field.section));
  }
  return slugs;
}

describe('DOC_PACK_REGISTRY', () => {
  it('lists every generator the app has today, and nothing else', () => {
    const incorp = DOC_PACK_REGISTRY.flatMap((d) => (d.generate.kind === 'incorp' ? [d.generate.doc] : []));
    expect([...incorp].sort()).toEqual([...INCORP_DOC_KINDS].sort());
    expect(DOC_PACK_REGISTRY.filter((d) => d.generate.kind === 'board-resolution')).toHaveLength(1);
    expect(new Set(DOC_PACK_REGISTRY.map((d) => d.id)).size).toBe(DOC_PACK_REGISTRY.length);
  });

  it('only points at steps that exist in the catalog', () => {
    const ids = new Set(checklist.map((c) => c.id));
    for (const def of DOC_PACK_REGISTRY) {
      for (const stepId of def.sourceStepIds) expect(ids.has(stepId), `${def.id} → ${stepId}`).toBe(true);
    }
    for (const input of allInputs()) {
      expect(ids.has(input.stepId), `${input.key} → ${input.stepId}`).toBe(true);
    }
  });

  it('every tabId exists in at least one ownership variant of its step', () => {
    for (const input of allInputs()) {
      if (!input.tabId) continue;
      const slugs = sectionSlugsFor(input.stepId);
      expect(slugs.has(input.tabId), `${input.key}: ${input.tabId} not in ${[...slugs].join(', ')}`).toBe(true);
    }
  });

  it('uses only the two release gates the app can answer', () => {
    for (const def of DOC_PACK_REGISTRY) {
      if (def.releaseGate) expect(['br-finalized', 'directors-accepted']).toContain(def.releaseGate);
    }
  });
});
