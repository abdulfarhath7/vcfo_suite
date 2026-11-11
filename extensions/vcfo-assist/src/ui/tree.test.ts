import { describe, expect, it } from 'vitest';
import { parseCatalog } from '../suite/suite-client';
import { MOCK_ONLY_NOTE, catalogTree, packIsLive, taskChips, tasksIn, trail } from './tree';

/** The shape Suite's GET /api/assist/catalog sends (a trimmed copy). */
const SUITE_CATALOG = {
  ok: true,
  liveEnabled: false,
  liveHosts: [],
  packs: [
    { id: 'mca-v3', title: 'MCA V3', legalStatus: 'mock-only', live: false, needsCsOpinionFirst: false },
    { id: 'income-tax-efiling', title: 'Income tax', legalStatus: 'mock-only', live: false, needsCsOpinionFirst: false },
    { id: 'gst', title: 'GST', legalStatus: 'mock-only', live: false, needsCsOpinionFirst: true },
    // A server that says "live" for a pack that is not cs-cleared is not believed.
    { id: 'traces', title: 'TRACES', legalStatus: 'mock-only', live: true },
  ],
  agents: [
    { id: 'incorporation', title: 'Incorporation', subAgents: [{ id: 'spice-a', title: 'Name reservation', form: 'SPICe+ Part A', status: 'beta', recipeId: 'spice-a', pack: 'mca-v3', kind: 'portal-fill', path: ['incorporation', 'spice-a'] }] },
    { id: 'compliance', title: 'Compliance', subAgents: [{ id: 'challan-281', title: 'Monthly TDS challan', form: 'Challan 281 (ITNS 281)', status: 'later', recipeId: null, pack: 'income-tax-efiling', kind: 'challan-prepare' }] },
  ],
  tree: [
    { type: 'group', id: 'incorporation', title: 'Incorporation', children: [{ type: 'task', id: 'spice-a', title: 'Name reservation', form: 'SPICe+ Part A', status: 'beta', recipeId: 'spice-a', pack: 'mca-v3', kind: 'portal-fill', gates: ['LOGIN', 'SUBMIT', 'PAY'], path: ['incorporation', 'spice-a'] }] },
    {
      type: 'group',
      id: 'compliance',
      title: 'Compliance',
      children: [
        {
          type: 'group',
          id: 'income-tax-tds',
          title: 'Income tax & TDS',
          children: [
            { type: 'group', id: 'tds', title: 'TDS', children: [{ type: 'task', id: 'challan-281', title: 'Monthly TDS challan', form: 'Challan 281 (ITNS 281)', status: 'later', recipeId: null, pack: 'income-tax-efiling', kind: 'challan-prepare', gates: ['LOGIN', 'PAY'], note: 'The agent prepares the challan; you create it and pay it through your own bank.', path: ['compliance', 'income-tax-tds', 'tds', 'challan-281'] }] },
          ],
        },
        { type: 'group', id: 'registration-like', title: 'GST', children: [{ type: 'task', id: 'gst-reg-01', title: 'GST registration', form: 'GST REG-01', status: 'later', pack: 'gst', kind: 'portal-fill' }] },
      ],
    },
  ],
};

describe('catalog tree in the side panel', () => {
  const catalog = parseCatalog(SUITE_CATALOG);

  it('reads the tree to any depth, with each task\'s pack, kind, gates and note', () => {
    const tree = catalogTree(catalog);
    expect(tree.map((n) => n.id)).toEqual(['incorporation', 'compliance']);
    const challan = tasksIn(tree[1]!).find((t) => t.id === 'challan-281')!;
    expect(challan).toMatchObject({ pack: 'income-tax-efiling', kind: 'challan-prepare', gates: ['LOGIN', 'PAY'], status: 'later', path: ['compliance', 'income-tax-tds', 'tds', 'challan-281'] });
    expect(challan.note).toMatch(/pay it through your own bank/);
  });

  it('gives a breadcrumb from the agent down to a task', () => {
    expect(trail(catalogTree(catalog), 'challan-281').map((n) => n.id)).toEqual(['compliance', 'income-tax-tds', 'tds', 'challan-281']);
    expect(trail(catalogTree(catalog), 'nope')).toEqual([]);
  });

  it('builds one level from the flat agents when an older Suite sends no tree', () => {
    const { tree: _tree, ...flat } = SUITE_CATALOG;
    const tree = catalogTree(parseCatalog(flat));
    expect(tree.map((n) => [n.id, n.type])).toEqual([['incorporation', 'group'], ['compliance', 'group']]);
    expect(tasksIn(tree[0]!).map((t) => t.id)).toEqual(['spice-a']);
  });

  it('shows Ready, Beta or Later, and "Needs CS opinion" for a pack like GST', () => {
    const tasks = catalogTree(catalog).flatMap(tasksIn);
    const chips = (id: string) => taskChips(tasks.find((t) => t.id === id)!, catalog).map((c) => c.label);
    expect(chips('spice-a')).toEqual(['Beta']);
    expect(chips('challan-281')).toEqual(['Later']);
    expect(chips('gst-reg-01')).toEqual(['Later', 'Needs CS opinion']);
  });

  it('says "Mock only until the CS opinion" for a task whose pack is not live, and never trusts "live" on an uncleared pack', () => {
    const tasks = catalogTree(catalog).flatMap(tasksIn);
    expect(packIsLive(tasks.find((t) => t.id === 'spice-a')!, catalog)).toBe(false);
    expect(catalog.packs!.find((p) => p.id === 'traces')!.live).toBe(false);
    expect(MOCK_ONLY_NOTE).toBe('Mock only until the CS opinion');
    const cleared = parseCatalog({ ...SUITE_CATALOG, packs: [{ id: 'mca-v3', title: 'MCA', legalStatus: 'cs-cleared', live: true }] });
    expect(packIsLive(tasks.find((t) => t.id === 'spice-a')!, cleared)).toBe(true);
  });

  it('drops nodes nested deeper than any catalog should go', () => {
    let node: Record<string, unknown> = { type: 'task', id: 'deep', title: 'Deep' };
    for (let i = 0; i < 12; i += 1) node = { type: 'group', id: `g${i}`, title: `G${i}`, children: [node] };
    const tree = catalogTree(parseCatalog({ agents: [], tree: [node] }));
    expect(tree.flatMap(tasksIn)).toEqual([]);
  });
});
