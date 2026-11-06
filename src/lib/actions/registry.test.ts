import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AppRole } from '@/auth/guards';
import { actionsForRole, getAction, indexActions } from './registry';
import { agentMayExecute, defineAction, needsApproval, type ActionTier, type AnyAction } from './types';

const action = (name: string, tier: ActionTier = 'T0') =>
  defineAction({
    name,
    description: name,
    input: z.object({}),
    tier,
    roles: ['admin'],
    preview: async () => null,
    execute: async () => ({ ok: true, summary: 'done' }),
  });

describe('action registry', () => {
  it('indexes actions by name', () => {
    const index = indexActions([['tasks', [action('tasks.create')]]]);
    expect(index.get('tasks.create')?.description).toBe('tasks.create');
  });

  it('refuses an action outside its area and a duplicate name', () => {
    expect(() => indexActions([['tasks', [action('labour.close')]]])).toThrow(/outside area/);
    expect(() => indexActions([['tasks', [action('tasks.a'), action('tasks.a')]]])).toThrow(/Duplicate/);
  });

  it('loads every area file and finds nothing that was not registered', async () => {
    expect(await getAction('no.such')).toBeNull();
    expect(Array.isArray(await actionsForRole('admin'))).toBe(true);
    // Every area file is imported here for the first time, which is slow in a loaded test run.
  }, 30_000);
});

describe('the whole registry', () => {
  const ROLES: AppRole[] = ['super_admin', 'admin', 'manager', 'intern', 'client', 'developer', 'partner'];
  const here = join(process.cwd(), 'src/lib/actions');
  const areas = readdirSync(here, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
  const registered = async () => new Set((await Promise.all(ROLES.map(actionsForRole))).flat().map((a) => a.name));

  it('lists every action of every area folder, and every action a source file names', async () => {
    const names = await registered();
    const listed = await Promise.all(areas.map(async (area) => ((await import(`./${area}/index.ts`)) as { actions: AnyAction[] }).actions));
    expect(new Set(listed.flat().map((a) => a.name))).toEqual(names);

    // A factory builds some names, so this only checks the other way: a written name is never left out.
    const written = sources(here).flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/\bname: ['"`]([a-z-]+\.[a-zA-Z]+)['"`]/g)].map((match) => match[1]!));
    expect(written.length).toBeGreaterThan(90);
    expect(written.filter((name) => !names.has(name))).toEqual([]);
  }, 60_000);

  it('holds the expected number of actions in each area, so a lost one fails here', async () => {
    const counts: Record<string, number> = {};
    for (const name of await registered()) {
      const area = name.split('.')[0]!;
      counts[area] = (counts[area] ?? 0) + 1;
    }
    expect(counts).toEqual({
      tasks: 10,
      requests: 3,
      reminders: 2,
      documents: 4,
      statuses: 3,
      notes: 3,
      checklist: 2,
      compliance: 19,
      registrations: 8,
      'board-meetings': 13,
      receivables: 21,
      labour: 7,
      'client-portal': 14,
      filing: 1,
    });
  }, 60_000);

  it('gives no action to a developer or a partner, and holds no T4 action to run', async () => {
    expect(await actionsForRole('developer')).toEqual([]);
    expect(await actionsForRole('partner')).toEqual([]);
    for (const role of ROLES) for (const a of await actionsForRole(role)) expect(agentMayExecute(a.tier)).toBe(true);
  }, 60_000);
});

describe('tier rules', () => {
  it('never lets the agent execute T4', () => {
    expect(agentMayExecute('T4')).toBe(false);
    for (const tier of ['T0', 'T1', 'T2', 'T3'] as const) expect(agentMayExecute(tier)).toBe(true);
  });

  it('asks for approval on T2 and T3 only', () => {
    expect(['T0', 'T1', 'T2', 'T3', 'T4'].filter((t) => needsApproval(t as ActionTier))).toEqual(['T2', 'T3']);
  });
});
