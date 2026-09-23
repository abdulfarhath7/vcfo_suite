import { beforeEach, describe, expect, it, vi } from 'vitest';

import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';

vi.mock('server-only', () => ({}));

const patchChecklistItem = vi.fn(async () => undefined);
vi.mock('@/db/repositories/engagements', () => ({
  patchChecklistItem: (...args: unknown[]) => patchChecklistItem(...(args as [])),
}));
vi.mock('@/lib/incorporation-docs/storage', () => ({
  uploadIncorpDocx: async (_id: string, doc: string, audience: string) => `eng/${doc}/${audience}.docx`,
  downloadIncorpDocx: async () => null,
}));

const { generateAllIncorpDocsBestEffort } = await import('@/lib/api/incorporation-docs-generate');

const ctx = { userId: 'u', role: 'intern', email: 'lead@example.test', name: 'Lead' } as never;
const engagement = { id: 'eng', companyName: 'Test Company Private Limited' } as never;

describe('Generate all, best effort', () => {
  beforeEach(() => patchChecklistItem.mockClear());

  it('one director missing data fails only their rows; the rest are stored in one patch', async () => {
    const state = fullState([
      director('e1', 'yes', 'Alpha'),
      director('e2', 'yes', 'Beta', { fatherName: '' }),
    ]);
    const result = await generateAllIncorpDocsBestEffort(ctx, engagement, state, ['dir-2', 'inc-9', 'moa']);

    expect(result.failures.map((f) => `${f.doc}:${f.audience}`)).toEqual(['dir-2:resident-2', 'inc-9:resident-2']);
    expect(result.failures[0]?.code).toBe('missing_fields');
    expect(Object.keys(result.responsePatch).sort()).toEqual([
      'moaDraftUrl',
      'residentDirectorDir2DraftUrl',
      'residentDirectorInc9DraftUrl',
    ]);
    expect(patchChecklistItem).toHaveBeenCalledTimes(1);
  });

  it('directors not accepted still stops the whole run', async () => {
    const state = fullState([director('e1', 'yes', 'Alpha'), director('e2', 'no', 'Beta')], { accepted: false });
    await expect(generateAllIncorpDocsBestEffort(ctx, engagement, state)).rejects.toMatchObject({
      code: 'pre6_not_accepted',
    });
    expect(patchChecklistItem).not.toHaveBeenCalled();
  });
});
