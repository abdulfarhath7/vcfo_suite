import { describe, expect, it } from 'vitest';
import type { DocNode } from '@/lib/client-portal/documents';
import type { PortalIncorporationModel } from '@/lib/client-portal/step-model';
import { buildEntries, DOC_FILTERS, matchesFilter, treeRows } from './model';

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

describe('documents filter chips', () => {
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

describe('treeRows', () => {
  const nodes = [node({ id: 'a', categoryId: 'c1' }), node({ id: 'b', categoryId: 'c3', fromSbc: true }), node({ id: 'c', categoryId: 'c1', status: 'Missing' })];
  const entries = buildEntries(nodes, {} as PortalIncorporationModel, 1);
  const all = () => true;
  const open = () => true;

  it('lists each folder, then its files, with the tree depth', () => {
    const rows = treeRows(entries, all, open);
    expect(rows.map((r) => [r.e.id, r.depth])).toEqual([
      ['c:c1', 0],
      ['a', 1],
      ['c', 1],
      ['c:c3', 0],
      ['b', 1],
    ]);
  });

  it('hides the files of a closed folder, but a search opens every folder', () => {
    const shut = (id: string) => id !== 'c:c1';
    expect(treeRows(entries, all, shut).map((r) => r.e.id)).toEqual(['c:c1', 'c:c3', 'b']);
    expect(treeRows(entries, all, shut)[0]!.open).toBe(false);
    expect(treeRows(entries, all, shut, true).map((r) => r.e.id)).toEqual(['c:c1', 'a', 'c', 'c:c3', 'b']);
  });

  it('drops a folder when the chip filter leaves no file in it', () => {
    const rows = treeRows(entries, (n) => matchesFilter(n, 'sbc'), open);
    expect(rows.map((r) => r.e.id)).toEqual(['c:c3', 'b']);
  });
});
