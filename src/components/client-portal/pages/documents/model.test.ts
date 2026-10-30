import { describe, expect, it } from 'vitest';
import type { DocNode } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { buildEntries, DOC_FILTERS, groupEntries, matchesFilter } from './model';

function node(over: Partial<DocNode>): DocNode {
  return {
    id: 'n',
    label: 'PAN card',
    fileName: 'pan.pdf',
    status: 'Final',
    replaced: false,
    from: 'Northwind',
    fromSbc: false,
    categoryId: 'c1',
    source: 'milestone',
    ...over,
  };
}

describe('documents table filters', () => {
  it('lists the four chips in the owner order', () => {
    expect(DOC_FILTERS.map((f) => f.label)).toEqual(['All', 'Waiting on you', 'From SBC', 'Signed']);
  });

  it('sorts each document into the right chip', () => {
    const missing = node({ status: 'Missing', from: 'Asked by Arjun' });
    const sbc = node({ fromSbc: true });
    const signed = node({ signed: true });
    expect(matchesFilter(missing, 'you')).toBe(true);
    expect(matchesFilter(sbc, 'you')).toBe(false);
    expect(matchesFilter(sbc, 'sbc')).toBe(true);
    expect(matchesFilter(missing, 'sbc')).toBe(false);
    expect(matchesFilter(signed, 'signed')).toBe(true);
    expect(matchesFilter(sbc, 'signed')).toBe(false);
    for (const n of [missing, sbc, signed]) expect(matchesFilter(n, 'all')).toBe(true);
  });
});

describe('groupEntries', () => {
  it('puts every file under its top folder once, with its own folder', () => {
    const nodes = [node({ id: 'a', categoryId: 'c1' }), node({ id: 'b', categoryId: 'c3' }), node({ id: 'c', categoryId: 'c1', status: 'Missing' })];
    const groups = groupEntries(buildEntries(nodes, {} as PortalIncorporationModel, 1));
    expect(groups.map((g) => g.folder.id)).toEqual(['c:c1', 'c:c3']);
    expect(groups[0]!.files.map((x) => x.node.id)).toEqual(['a', 'c']);
    expect(groups[0]!.files[0]!.leaf.id).toBe('c:c1');
  });
});
