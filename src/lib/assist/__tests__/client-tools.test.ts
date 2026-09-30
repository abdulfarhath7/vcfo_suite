import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLIENT_TOOLS, type ClientToolContext } from '@/lib/assist/tools/client';

const ctx: ClientToolContext = {
  snapshot: {
    companyName: 'Acme',
    legalForm: 'company',
    residency: 'foreign',
    hasForeignParent: true,
    currentPhase: 'SPICe+ Part A',
    currentStep: { id: 'pre-2', title: 'Draft Board Resolution', owner: 'lead', status: 'with the firm' },
    completedStepCount: 1,
    totalActiveSteps: 40,
    incorporated: false,
  },
  state: {
    'pre-1': { status: 'completed', completedOn: '2026-09-01' },
    'pre-2': {
      status: 'in-progress',
      responses: { boardResolutionDraft: 'DRAFT: RESOLVED THAT the company invests…' },
    },
  } as never,
  filings: [],
  now: new Date('2026-10-01T00:00:00Z'),
};

describe('client tools', () => {
  it('never return board resolution draft content', async () => {
    for (const tool of Object.values(CLIENT_TOOLS)) {
      const out = JSON.stringify(await tool.run(ctx, { stepId: 'pre-2', days: 30 }));
      expect(out).not.toContain('RESOLVED THAT');
      expect(out).not.toContain('boardResolutionDraft');
    }
  });

  it('do not import the board resolution repository or storage', () => {
    for (const file of ['src/lib/assist/tools/client.ts', 'src/lib/assist/snapshot.ts', 'src/lib/assist/snapshot-build.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/board-resolution/);
    }
  });

  it('explain a locked step with the gate unlock copy', async () => {
    const out = (await CLIENT_TOOLS.getStepExplainerContext!.run(ctx, { stepId: 'pre-13' })) as {
      locked: boolean;
      unlocks: string | null;
    };
    expect(out.locked).toBe(true);
    expect(out.unlocks).toMatch(/^This opens after .+ is complete\.$/);
  });

  it('refuse unknown and legacy steps', async () => {
    expect(await CLIENT_TOOLS.getStepExplainerContext!.run(ctx, { stepId: 'reg-2' })).toMatchObject({ error: 'unknown_step' });
  });
});
