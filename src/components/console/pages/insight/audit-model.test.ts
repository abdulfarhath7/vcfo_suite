import { describe, expect, it } from 'vitest';
import type { AuditEventRow } from '@/lib/audit-log';
import { mergeAuditPages, nextAuditBefore, parseAuditBefore } from '@/lib/audit-paging';
import { auditCsv, dayStrip, eventLinks, facetCounts, filterEvents, groupByDay, inStage, metadataFacts, NO_FILTERS, roleLabel } from './audit-model';
import { csvCell, timeIst } from './fmt';

const ev = (id: string, created_at: string, over: Partial<AuditEventRow> = {}): AuditEventRow => ({
  id,
  created_at,
  actor_user_id: 'u1',
  actor_role: 'manager',
  actor_email: 'anita@demo.local',
  actor_name: 'Anita Rao',
  engagement_id: 'db-1',
  action: 'checklist.review',
  summary: 'Accepted Registered office address',
  metadata: { itemId: 'pre-1' },
  ...over,
});
const names = (id: string) => (id === 'db-1' ? 'Northwind Technologies' : undefined);

describe('filterEvents — the live filters plus the day', () => {
  const list = [
    ev('1', '2026-10-29T05:00:00Z'),
    ev('2', '2026-10-28T05:00:00Z', { actor_role: 'client', action: 'milestone_document.upload', summary: 'Uploaded passport', engagement_id: null }),
    ev('3', '2026-10-27T20:00:00Z', { actor_role: 'intern', action: 'welcome_email.send', summary: 'Sent' }),
  ];
  it('filters by role, type and India day', () => {
    expect(filterEvents(list, { ...NO_FILTERS, role: 'client' }, names).map((e) => e.id)).toEqual(['2']);
    expect(filterEvents(list, { ...NO_FILTERS, category: 'email' }, names).map((e) => e.id)).toEqual(['3']);
    // 27 Oct 20:00 UTC is 28 Oct in India
    expect(filterEvents(list, { ...NO_FILTERS, day: '2026-10-28' }, names).map((e) => e.id)).toEqual(['2', '3']);
  });
  it('searches the project name and the action label', () => {
    expect(filterEvents(list, { ...NO_FILTERS, search: 'northwind' }, names).map((e) => e.id)).toEqual(['1', '3']);
    expect(filterEvents(list, { ...NO_FILTERS, search: 'milestone reviewed' }, names).map((e) => e.id)).toEqual(['1']);
  });
  it('groups by day, counts the strip and the facets', () => {
    expect(groupByDay(list).map((g) => [g.day, g.events.length])).toEqual([
      ['2026-10-29', 1],
      ['2026-10-28', 2],
    ]);
    const strip = dayStrip(list, '2026-10-29');
    expect(strip).toHaveLength(14);
    expect(strip[13]).toEqual({ day: '2026-10-29', n: 1 });
    expect(strip[12]).toEqual({ day: '2026-10-28', n: 2 });
    expect(facetCounts(list).category).toMatchObject({ all: 3, checklist: 1, documents: 1, email: 1 });
  });
  it('the Stage filter keeps clients of that stage only', () => {
    expect(inStage(list, 'inc', (id) => (id === 'db-1' ? 'inc' : undefined)).map((e) => e.id)).toEqual(['1', '3']);
    expect(inStage(list, 'cmp', () => 'inc')).toEqual([]);
    expect(inStage(list, 'all', () => undefined)).toHaveLength(3);
  });
});

describe('details, doors and export', () => {
  it('turns metadata into facts', () => {
    expect(metadataFacts({ itemId: 'pre-1', previous_path: 'a/b', n: 2, x: { y: 1 }, z: null })).toEqual([
      { k: 'Item id', v: 'pre-1' },
      { k: 'Previous path', v: 'a/b' },
      { k: 'N', v: '2' },
      { k: 'X', v: '{"y":1}' },
      { k: 'Z', v: '—' },
    ]);
  });
  it('opens the step and the client from the seat base', () => {
    const links = eventLinks(ev('1', '2026-10-29T05:00:00Z'), { id: 'e1', slug: 'northwind' }, '/app/intern');
    expect(links.map((l) => l.href)).toEqual([expect.stringMatching(/^\/app\/intern\/projects\/northwind\/step\//), '/app/intern/projects/northwind']);
    expect(eventLinks(ev('2', '2026-10-29T05:00:00Z', { action: 'knowledge_bank.upload', metadata: {} }), undefined, '/app/manager').map((l) => l.href)).toEqual(['/app/manager/knowledge-bank']);
  });
  it('exports CSV with India time, quoting and defused formulas', () => {
    const csv = auditCsv([ev('1', '2026-10-29T05:00:00Z', { summary: '=SUM(1,2)' })], names).split('\r\n');
    expect(csv[0]).toBe('Date,Time,Type,Action,Summary,Who,Email,Role,Project,Target,Details,Action code');
    expect(csv[1]).toContain('2026-10-29,10:30,Milestones,Milestone reviewed,"\'=SUM(1,2)",Anita Rao');
    expect(csv[1]).toContain('Project manager,Northwind Technologies,Milestone');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(roleLabel('intern')).toBe('Project lead');
    expect(timeIst('2026-10-29T09:00:00Z')).toBe('2:30 pm');
  });
});

describe('audit paging', () => {
  it('parses the cursor and steps one millisecond past the oldest event', () => {
    expect(parseAuditBefore(null)).toBeUndefined();
    expect(parseAuditBefore('nope')).toBeUndefined();
    expect(parseAuditBefore('2026-10-29T05:00:00.000Z')!.toISOString()).toBe('2026-10-29T05:00:00.000Z');
    expect(nextAuditBefore([{ created_at: '2026-10-29T05:00:00.000Z' }, { created_at: '2026-10-28T05:00:00.123Z' }])).toBe('2026-10-28T05:00:00.124Z');
    expect(nextAuditBefore([])).toBeUndefined();
  });
  it('merges pages once each, newest first', () => {
    const a = ev('a', '2026-10-29T05:00:00Z');
    const b = ev('b', '2026-10-28T05:00:00Z');
    const c = ev('c', '2026-10-27T05:00:00Z');
    expect(mergeAuditPages([[a, b], [b, c]]).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});
