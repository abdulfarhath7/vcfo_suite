import { describe, expect, it } from 'vitest';
import { getItem } from '@/data/checklist';
import { ACTIVITY_SEED } from '@/data/compliance-activities';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist/checklist-responses';
import { ASSIST_AGENTS, ASSIST_CATALOG_TREE, allSubAgents, assistHostAllowed, assistLiveHosts, assistLivePortalsEnabled, assistPackStatus, findSubAgent, tasksUnder, treeDepth, type AssistCatalogNode } from './catalog';
import { getPack, getRecipe } from './registry';

describe('assist agent catalog', () => {
  it('has the four agents in order, the sixteen original task ids unchanged, and the tax tasks after them', () => {
    expect(ASSIST_AGENTS.map((a) => a.id)).toEqual(['incorporation', 'post-incorporation', 'registration', 'compliance']);
    expect(allSubAgents().map((s) => s.id)).toEqual([
      'spice-a', 'spice-b', 'agile-pro-s', 'emoa', 'eaoa', 'inc-9',
      'inc-20a', 'adt-1',
      'gst-reg-01', 'udyam', 'iec', 'shops-establishment', 'pt',
      'dir-3-kyc', 'aoc-4', 'mgt-7',
      'challan-281', 'tds-return-24q-26q', 'form-16', 'challan-280', 'itr',
    ]);
    expect(new Set(allSubAgents().map((s) => s.id)).size).toBe(allSubAgents().length);
  });

  it('is a tree of any depth: Compliance › Income tax & TDS › TDS › Monthly TDS challan', () => {
    expect(treeDepth()).toBe(4);
    const challan = findSubAgent('challan-281')!;
    expect(challan.path).toEqual(['compliance', 'income-tax-tds', 'tds', 'challan-281']);
    expect(findSubAgent('challan-280')!.path).toEqual(['compliance', 'income-tax-tds', 'income-tax', 'challan-280']);
    expect(findSubAgent('spice-a')!.path).toEqual(['incorporation', 'spice-a']);
    expect(findSubAgent('dir-3-kyc')!.path).toEqual(['compliance', 'mca-annual', 'dir-3-kyc']);
    const titles = (nodes: readonly AssistCatalogNode[]): string[] => nodes.flatMap((n) => (n.type === 'group' ? [n.title, ...titles(n.children)] : []));
    expect(titles(ASSIST_CATALOG_TREE)).toEqual(expect.arrayContaining(['Income tax & TDS', 'TDS', 'Income tax']));
    for (const node of ASSIST_CATALOG_TREE) expect(tasksUnder(node)).toEqual(ASSIST_AGENTS.find((a) => a.id === node.id)!.subAgents);
  });

  it('gives every task a pack the registry holds (or none for state portals), a kind and human gates', () => {
    for (const sub of allSubAgents()) {
      if (sub.pack) expect(getPack(sub.pack), sub.id).toBeTruthy();
      else expect(sub.portal).toBe('state');
      expect(['portal-fill', 'file-builder', 'challan-prepare']).toContain(sub.kind);
      expect(sub.gates.length).toBeGreaterThan(0);
      if (sub.pack) for (const g of sub.gates) expect(getPack(sub.pack)!.gates, `${sub.id} ${g}`).toContain(g);
      if (sub.recipeId) expect(getRecipe(sub.recipeId)!.pack).toBe(sub.pack);
    }
  });

  it('prepares challans and leaves the payment to the person; 24Q/26Q is a file builder', () => {
    for (const id of ['challan-281', 'challan-280']) {
      const t = findSubAgent(id)!;
      expect(t).toMatchObject({ kind: 'challan-prepare', pack: 'income-tax-efiling', status: 'later' });
      expect(t.gates).toContain('PAY');
      expect(t.note).toMatch(/pay it through your own bank/);
    }
    expect(findSubAgent('tds-return-24q-26q')).toMatchObject({ kind: 'file-builder', pack: 'protean-tin' });
    expect(findSubAgent('form-16')).toMatchObject({ pack: 'traces' });
  });

  it('gives every sub-agent its own agent id', () => {
    for (const agent of ASSIST_AGENTS) for (const sub of agent.subAgents) expect(sub.agent).toBe(agent.id);
  });

  it('names checklist steps that exist, with the right prefix per agent', () => {
    const prefix: Record<string, RegExp> = { incorporation: /^pre-\d+$/, 'post-incorporation': /^post-\d+$/, registration: /^reg-\d+$/ };
    for (const sub of allSubAgents()) {
      if (sub.agent === 'compliance') {
        expect(sub.stepId).toBeNull();
        // The tax tasks have no compliance activity yet.
        if (sub.activityId) expect(ACTIVITY_SEED.some((a) => a.id === sub.activityId)).toBe(true);
        else expect(sub.path[1]).toBe('income-tax-tds');
        continue;
      }
      expect(sub.stepId, sub.id).toMatch(prefix[sub.agent]!);
      expect(getItem(sub.stepId!), `${sub.id} → ${sub.stepId}`).toBeDefined();
    }
  });

  it('writes the SRN only into an existing staff field on that step', () => {
    for (const sub of allSubAgents().filter((s) => s.srnField)) {
      const fields = CLIENT_RESPONSE_FIELDS[sub.stepId!] ?? [];
      const field = fields.find((f) => f.id === sub.srnField);
      expect(field, `${sub.id} ${sub.srnField}`).toBeDefined();
      expect(field!.type).toBe('textarea');
    }
  });

  it('points recipes at files the registry holds, and only beta or ready agents have one', () => {
    for (const sub of allSubAgents()) {
      if (sub.recipeId) {
        expect(getRecipe(sub.recipeId)?.subAgent).toBe(sub.id);
        expect(sub.status).not.toBe('later');
      } else {
        expect(sub.status).toBe('later');
      }
    }
    expect(findSubAgent('spice-a')?.status).toBe('beta');
    expect(findSubAgent('spice-b')).toMatchObject({ status: 'beta', recipeId: 'spice-b' });
    expect(allSubAgents().filter((s) => s.recipeId).map((s) => s.id)).toEqual(['spice-a', 'spice-b', 'agile-pro-s', 'emoa', 'eaoa']);
  });

  it('allows the mock host always, and a live host only through its own live, cs-cleared pack', () => {
    expect(assistHostAllowed('localhost:3100', {})).toBe(true);
    expect(assistHostAllowed('www.mca.gov.in', {})).toBe(false);
    // Every pack is still mock-only, so neither the new switch nor the old alias opens a live host.
    expect(assistHostAllowed('www.mca.gov.in', { ASSIST_LIVE_PACKS: 'mca-v3' })).toBe(false);
    expect(assistHostAllowed('www.mca.gov.in', { ASSIST_LIVE_PORTALS: 'true' })).toBe(false);
    expect(assistLivePortalsEnabled({ ASSIST_LIVE_PACKS: 'mca-v3,gst' })).toBe(false);
    expect(assistLiveHosts({ ASSIST_LIVE_PACKS: 'mca-v3' })).toEqual([]);
    expect(assistHostAllowed('mock.sbc.test', { ASSIST_MOCK_HOSTS: 'mock.sbc.test' })).toBe(true);
    expect(assistHostAllowed('localhost', { ASSIST_MOCK_HOSTS: 'mock.sbc.test' })).toBe(false);
  });

  it('reports each pack with its legal status and live flag', () => {
    const status = assistPackStatus({ ASSIST_LIVE_PACKS: 'mca-v3' });
    expect(status.find((p) => p.id === 'mca-v3')).toMatchObject({ legalStatus: 'mock-only', live: false, hosts: ['www.mca.gov.in'] });
    expect(status.find((p) => p.id === 'gst')).toMatchObject({ needsCsOpinionFirst: true, live: false });
  });
});
