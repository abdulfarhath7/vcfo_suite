import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole } from '@/auth/guards';
import type { AnyAction } from '@/lib/actions/types';
import type { LlmTool } from '@/lib/ask/provider';

/** What a model may see is decided in code: role, tier, kill switch and shell, before any request. */

// The repositories are not reached: only the definitions are read here.
vi.mock('@/db/client', () => ({ db: {} }));

const { actionsForRole } = await import('@/lib/actions/registry');
const { actionNameOf, actionsFor, agentTools, toolNameOf, toolOf } = await import('./tools');

// The first test loads every action module.
vi.setConfig({ testTimeout: 60_000 });

const STAFF: AppRole[] = ['super_admin', 'admin', 'manager', 'intern'];
const shellOf = (role: AppRole) => (role === 'super_admin' ? 'super' : 'admin') as 'super' | 'admin';

beforeEach(() => {
  delete process.env.ASK_KILL_TIERS;
});
afterEach(() => {
  delete process.env.ASK_KILL_TIERS;
});

const schemaOf = (tool: LlmTool) => tool.input_schema as { properties?: Record<string, unknown>; additionalProperties?: boolean; required?: string[] };

describe('tools for the agent', () => {
  it('shows a client only their own actions, and a developer nothing', async () => {
    const shown = await actionsFor('client', 'client');
    expect(shown.length).toBeGreaterThan(0);
    for (const action of shown) {
      expect(action.name.startsWith('client-portal.')).toBe(true);
      expect(action.roles).toEqual(['client']);
      expect(action.routerOnly).toBeFalsy();
      expect(action.tier).not.toBe('T4');
    }
    expect(await actionsFor('developer', 'admin')).toEqual([]);
  });

  it('keeps a client\'s actions out of every staff shell', async () => {
    for (const role of STAFF) expect((await actionsFor(role, shellOf(role))).some((a) => a.name.startsWith('client-portal.'))).toBe(false);
    expect(await actionsFor('manager', 'client')).toEqual([]);
  });

  it('shows no T4 action to anyone, and no action the role may not use', async () => {
    for (const role of STAFF) {
      const shown = await actionsFor(role, shellOf(role));
      expect(shown.length).toBeGreaterThan(0);
      for (const action of shown) {
        expect(action.tier).not.toBe('T4');
        expect(action.roles).toContain(role);
      }
    }
    const intern = (await actionsFor('intern', 'admin')).map((a) => a.name);
    expect(intern).not.toContain('tasks.create');
    expect(intern).not.toContain('tasks.edit');
    expect((await actionsFor('manager', 'admin')).map((a) => a.name)).toContain('tasks.create');
  });

  it('filters every role to exactly its own tools, area by area', async () => {
    const lead = { tasks: 10, requests: 3, reminders: 2, documents: 4, statuses: 3, notes: 3, compliance: 18, registrations: 8, 'board-meetings': 13, receivables: 21, labour: 7 };
    const expected: Array<[AppRole, 'super' | 'admin' | 'client', Record<string, number>]> = [
      ['super_admin', 'super', lead],
      ['admin', 'admin', lead],
      ['manager', 'admin', lead],
      ['intern', 'admin', { tasks: 8, requests: 3, reminders: 2, documents: 4, statuses: 3, notes: 3, compliance: 14, registrations: 8, 'board-meetings': 11, labour: 7 }],
      ['client', 'client', { 'client-portal': 9 }],
      ['client', 'admin', {}],
      ['developer', 'admin', {}],
      ['partner', 'admin', {}],
    ];
    for (const [role, shell, areas] of expected) {
      const counts: Record<string, number> = {};
      for (const { name } of await actionsFor(role, shell)) counts[name.split('.')[0]!] = (counts[name.split('.')[0]!] ?? 0) + 1;
      expect({ role, counts }).toEqual({ role, counts: areas });
    }
  });

  it('holds back from an intern what only a lead may do, and the reverse', async () => {
    const intern = (await actionsFor('intern', 'admin')).map((a) => a.name);
    const manager = (await actionsFor('manager', 'admin')).map((a) => a.name);
    const leadOnly = manager.filter((name) => !intern.includes(name) && !name.startsWith('receivables.'));
    expect(leadOnly.sort()).toEqual([
      'board-meetings.approve',
      'board-meetings.sendBack',
      'compliance.decideDateChange',
      'compliance.removeTaskLine',
      'compliance.reopenFiling',
      'compliance.setReminderLead',
      'compliance.setWorkingWindow',
      'tasks.create',
      'tasks.edit',
    ]);
    expect(intern.filter((name) => !manager.includes(name))).toEqual(['compliance.requestDateChange']);
  });

  it('marks only receivables firm-wide, so a run with no client reaches nothing else', async () => {
    for (const role of [...STAFF, 'client' as const]) {
      const firmWide = (await actionsFor(role, role === 'client' ? 'client' : shellOf(role))).filter((a) => a.firmWide);
      for (const action of firmWide) expect(action.name.startsWith('receivables.')).toBe(true);
      expect(firmWide.length).toBe(role === 'intern' || role === 'client' ? 0 : 21);
    }
  });

  it('takes a switched-off tier out of the list', async () => {
    process.env.ASK_KILL_TIERS = 'T3';
    const shown = await actionsFor('manager', 'admin');
    expect(shown.some((a) => a.tier === 'T3')).toBe(false);
    expect(shown.some((a) => a.tier === 'T2')).toBe(true);
  });

  it('offers the filing run only with its flag on, and never to a client', async () => {
    const named = async () => (await actionsFor('intern', 'admin')).some((a) => a.name === 'filing.prepareRun');
    vi.stubEnv('VCFO_ASSIST_ENABLED', 'on');
    expect(await named()).toBe(false);
    vi.stubEnv('ASK_ASSIST_HANDOFF_ENABLED', 'true');
    expect(await named()).toBe(true);
    expect((await actionsFor('client', 'client')).some((a) => a.name.startsWith('filing.'))).toBe(false);
    vi.unstubAllEnvs();
    expect(await named()).toBe(false);
  });

  it('keeps the data router\'s own actions away from the model', async () => {
    const all = await actionsForRole('manager');
    expect(all.some((a: AnyAction) => a.name === 'checklist.setResponse')).toBe(true);
    expect((await actionsFor('manager', 'admin')).some((a) => a.name.startsWith('checklist.'))).toBe(false);
  });

  it('loads about ten common tools, defers the rest, and stays inside the strict limit', async () => {
    const actions = await actionsFor('super_admin', 'super');
    expect(actions.length).toBeGreaterThanOrEqual(25);
    const tools = agentTools(actions);
    expect(tools[0]).toMatchObject({ name: 'tool_search_tool_bm25' });
    const custom = tools.slice(1) as Array<LlmTool & { defer_loading?: boolean }>;
    const loaded = custom.filter((t) => !t.defer_loading);
    expect(loaded.length).toBeGreaterThanOrEqual(8);
    expect(loaded.length).toBeLessThanOrEqual(14);
    expect(custom.filter((t) => t.strict).length).toBeLessThanOrEqual(20);
  });

  it('never lets the model name the client or a recipient', async () => {
    for (const action of await actionsFor('super_admin', 'super')) {
      const properties = Object.keys(schemaOf(toolOf(action)).properties ?? {});
      expect(properties).not.toContain('engagementId');
      expect(properties).not.toContain('recipients');
      expect(properties).not.toContain('needsManager');
    }
  });

  it('writes a schema strict tools accept, with examples that validate', async () => {
    for (const action of await actionsFor('super_admin', 'super')) {
      const tool = toolOf(action);
      const text = JSON.stringify(tool.input_schema);
      expect(schemaOf(tool).additionalProperties).toBe(false);
      for (const word of ['minLength', 'maxLength', 'pattern', 'format', '$schema', 'maxItems']) expect(text).not.toContain(`"${word}"`);
      for (const example of action.examples ?? []) expect(action.input.safeParse(example).success).toBe(true);
      expect(actionNameOf(toolNameOf(action.name))).toBe(action.name);
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    }
  });
});
