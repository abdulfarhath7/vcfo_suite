import { describe, expect, it } from 'vitest';
import { filterBooks, officialSource, sectionsOf, spine, tiers, type LibraryItem, type LibraryRead } from './model';

const book = (id: string, category: string, title: string, savedAt: string, topicSlug: string | null = null): LibraryItem => ({
  id,
  title,
  category,
  topicSlug,
  updated: false,
  savedAt,
  answer: { line: `${title} in one line`, citations: [], actions: [], origin: 'reviewed', depth: 'normal' },
});

const read = (itemId: string, lastReadAt: string): LibraryRead => ({
  ref: itemId,
  itemId,
  topicSlug: null,
  title: '',
  category: '',
  progressPct: 50,
  sectionsRead: 1,
  sectionsTotal: 2,
  lastReadAt,
  finishedAt: null,
});

describe('library model', () => {
  const items = [
    book('a', 'incorporation', 'SPICe+ Part A', '2026-10-01'),
    book('b', 'tax', 'GST basics', '2026-10-05'),
    book('c', 'your-project', 'Director KYC', '2026-10-03'),
    book('d', 'unknown-cat', 'Something else', '2026-09-01'),
  ];

  it('puts recently read books in tier 01 and the rest in disjoint category stacks', () => {
    const t = tiers(items, [read('b', '2026-10-10'), read('a', '2026-10-09')], 'Halcyon');
    expect(t[0]).toMatchObject({ rank: '01', name: 'Recently read', covers: true });
    expect(t[0]!.books.map((b) => b.id)).toEqual(['b', 'a']);
    const stacks = t.slice(1);
    expect(stacks.map((s) => s.name)).toEqual(['Halcyon’s project']);
    // unknown categories fall into the company's own stack
    expect(stacks[0]!.books.map((b) => b.id)).toEqual(['c', 'd']);
    expect(stacks[0]!.rank).toBe('02');
  });

  it('falls back to the latest saved books when nothing was read', () => {
    const t = tiers(items, [], 'Halcyon', 2);
    expect(t[0]!.name).toBe('Latest');
    expect(t[0]!.books.map((b) => b.id)).toEqual(['b', 'c']);
    expect(t.slice(1).flatMap((s) => s.books.map((b) => b.id)).sort()).toEqual(['a', 'd']);
  });

  it('filters by tab and text', () => {
    expect(filterBooks(items, 'tax', '').map((b) => b.id)).toEqual(['b']);
    expect(filterBooks(items, 'all', 'kyc').map((b) => b.id)).toEqual(['c']);
    expect(filterBooks(items, 'your-project', '').map((b) => b.id)).toEqual(['c', 'd']);
  });

  it('builds the table of contents from what the answer holds', () => {
    expect(sectionsOf({ line: 'x', citations: [], actions: [], origin: 'reviewed', depth: 'normal' })).toEqual(['In short']);
    expect(
      sectionsOf({ line: 'x', why: 'y', visual: { type: 'steps', items: [{ label: 'a' }, { label: 'b' }] }, citations: [{ id: '1', label: 'Act' }], actions: [], origin: 'reviewed', depth: 'normal' }),
    ).toEqual(['In short', 'Step by step', 'Why it matters', 'Sources']);
  });

  it('picks the first linked citation as the official source and shortens spines', () => {
    expect(officialSource({ line: 'x', citations: [{ id: '1', label: 'Rule' }, { id: '2', label: 'MCA', url: 'https://www.mca.gov.in/x' }], actions: [], origin: 'reviewed', depth: 'normal' })).toEqual({ label: 'mca.gov.in', url: 'https://www.mca.gov.in/x' });
    expect(spine('Companies Act, 2013')).toBe('Companies Act');
    expect(spine('GSTR-3B — monthly summary')).toBe('GSTR-3B');
  });
});
