import { describe, expect, it } from 'vitest';
import { documentHits, filingHits, hitPasses, obligationHits, regLabelOf } from './search-hits';

const now = new Date('2026-10-20T00:00:00Z');
const row = (over: Partial<Parameters<typeof filingHits>[0][number]> = {}) => ({
  id: 'f1',
  engagementId: 'eng-a',
  particular: 'GSTR-3B',
  compliance: 'GST',
  authority: 'GSTN',
  frequency: 'monthly',
  periodLabel: 'Sep 2026',
  dueDate: '2026-10-20',
  filedOn: null as string | null,
  ...over,
});

describe('client search hits', () => {
  it('gives each filing its regulator and status word', () => {
    const hits = filingHits(
      [row(), row({ id: 'f2', dueDate: '2026-10-01' }), row({ id: 'f3', filedOn: '2026-09-18' }), row({ id: 'f4', dueDate: '2026-12-20' })],
      '',
      now,
    );
    expect(hits.map((h) => h.status)).toEqual(['Due soon', 'Overdue', 'Done', 'Not started']);
    expect(hits.every((h) => h.reg === 'GST')).toBe(true);
    expect(hits[0]!.href).toBe('/app/client/compliances/filings?filing=f1');
  });

  it('groups filings into obligations with the worst open status and the page slug', () => {
    const hits = obligationHits([row(), row({ id: 'f2', dueDate: '2026-10-01' }), row({ id: 'f5', particular: 'Form 24Q', compliance: 'Income Tax', filedOn: '2026-07-30' })], '', now);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ title: 'GSTR-3B', status: 'Overdue', reg: 'GST', href: '/app/client/compliances/obligations/gstr-3b' });
    expect(hits[1]).toMatchObject({ title: 'Form 24Q', status: 'Done', reg: 'Income tax' });
  });

  it('adds the engagement to the obligation slug when the rows span two companies', () => {
    const hits = obligationHits([row(), row({ id: 'f9', engagementId: 'eng-b' })], '', now);
    expect(hits.map((h) => h.href)).toEqual([
      '/app/client/compliances/obligations/gstr-3b--eng-a',
      '/app/client/compliances/obligations/gstr-3b--eng-b',
    ]);
  });

  it('matches the query and leaves documents without a regulator or status', () => {
    expect(filingHits([row()], '24q', now)).toHaveLength(0);
    const docs = documentHits([{ id: '7', fileName: 'PAN card.pdf' }], 'pan');
    expect(docs).toEqual([{ group: 'Documents', title: 'PAN card.pdf', href: '/app/client/documents?doc=d-7' }]);
  });

  it('filters by the chips', () => {
    expect(hitPasses({ reg: 'GST', status: 'Overdue' }, 'GST', '')).toBe(true);
    expect(hitPasses({ reg: 'GST', status: 'Overdue' }, '', 'Done')).toBe(false);
    expect(hitPasses({}, 'MCA', '')).toBe(false);
    expect(hitPasses({}, '', '')).toBe(true);
    expect(regLabelOf(undefined, 'ROC')).toBe('MCA');
  });
});
