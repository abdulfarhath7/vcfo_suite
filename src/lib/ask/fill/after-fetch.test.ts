import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { DropState } from '@/lib/ask/drop/types';

/**
 * "Fetch bonterra data and put it in name application in vcfo suite" in a chat with no card: the
 * SharePoint fetch starts first and remembers the fill (mode and Phase 1 scope); when the drop's card
 * is ready the fill starts on it with that scope. A message that names no client keeps the old answer.
 */

const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'int-1' };

vi.mock('server-only', () => ({}));
vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: vi.fn(async () => [
    { id: 'eng-b', slug: 'bonterra', companyName: 'Bonterra India Private Limited', deletedAt: null },
    { id: 'eng-k', slug: 'kestrel', companyName: 'Kestrel Labs Private Limited', deletedAt: null },
  ]),
}));
const startDrop = vi.fn(async (..._a: unknown[]) => ({ ok: true as const, runId: 'drop-1', folderName: 'Bonterra', companyName: 'Bonterra India Private Limited', sources: 'the SharePoint folder Bonterra and the documents in the app' }));
vi.mock('@/lib/sharepoint/start-drop', () => ({ startSharepointDrop: (...a: unknown[]) => startDrop(...a) }));
const messages: Array<{ text: string; answer: { fill?: { runId: string; mode: string } } }> = [];
vi.mock('@/db/repositories/ask-messages', () => ({
  appendAskMessage: vi.fn(async (_ctx: unknown, _cid: string, input: (typeof messages)[number]) => {
    messages.push(input);
    return { id: 'msg-2' };
  }),
}));
class FillRefused extends Error {}
const startFill = vi.fn(async (..._a: unknown[]): Promise<{ runId: string; mode: 'manual' | 'auto'; view: { companyName: string } }> => ({
  runId: 'fill-1',
  mode: 'manual',
  view: { companyName: 'Bonterra India Private Limited' },
}));
vi.mock('./run', () => ({
  FillRefused,
  startFill: (...a: unknown[]) => startFill(...a),
  fillStartedLine: (started: { mode: string; view: { companyName: string } }, scope?: { label: string } | null) =>
    `filling ${started.view.companyName}${scope ? ` (${scope.label} only)` : ''} ${started.mode}`,
}));

const { startFetchThenFill, fillAfterDrop } = await import('./after-fetch');
const { scopeFromText, isFillRequest } = await import('./intent');

const PROD = 'fetch bonterra data and put it in name application in vcfo suite';

beforeEach(() => {
  vi.clearAllMocks();
  messages.length = 0;
});

describe('startFetchThenFill', () => {
  it('fetches the named client first and remembers a Phase 1 fill', async () => {
    expect(isFillRequest(PROD)).toBe(true);
    const scope = scopeFromText(PROD);
    expect(scope?.stepIds).toEqual(['pre-1', 'pre-2', 'pre-3', 'pre-4', 'pre-5']);
    const out = await startFetchThenFill(lead, { message: PROD, conversationId: 'conv-1', mode: 'manual', scope });
    expect(out?.runId).toBe('drop-1');
    expect(out?.line).toMatch(/reading the SharePoint folder Bonterra/);
    expect(out?.line).toMatch(/Name Application/);
    expect(startDrop).toHaveBeenCalledTimes(1);
    const [ctx, input] = startDrop.mock.calls[0] as [AuthContext, Record<string, unknown>];
    expect(ctx).toBe(lead);
    expect(input).toMatchObject({ engagementId: 'eng-b', conversationId: 'conv-1', projectPath: '/projects/bonterra', fillAfter: { mode: 'manual', scope } });
  });

  it('fetches the project on screen when the message asks to fetch but names no client', async () => {
    const out = await startFetchThenFill(lead, { message: 'fetch the folder and fill it into the app', conversationId: 'conv-1', pagePath: '/app/lead/projects/kestrel', mode: 'auto', scope: null });
    expect(out?.runId).toBe('drop-1');
    expect(startDrop.mock.calls[0]![1]).toMatchObject({ engagementId: 'eng-k', fillAfter: { mode: 'auto' } });
  });

  it('returns null when there is nothing to fetch, so the old "no open card" answer stays', async () => {
    expect(await startFetchThenFill(lead, { message: 'put these values in the app', conversationId: 'conv-1', mode: 'manual', scope: null })).toBeNull();
    expect(startDrop).not.toHaveBeenCalled();
  });

  it('reads the whole folder of the project on screen for any fill request ("fill everything")', async () => {
    expect(isFillRequest('fill everything')).toBe(true);
    const out = await startFetchThenFill(lead, { message: 'fill everything', conversationId: 'conv-1', pagePath: '/app/lead/projects/bonterra', mode: 'auto', scope: null, implied: true });
    expect(out?.runId).toBe('drop-1');
    expect(startDrop.mock.calls[0]![1]).toMatchObject({ engagementId: 'eng-b', wholeFolder: true, fillAfter: { mode: 'auto' } });
  });

  it('reads the client a fill request names, with no fetch words ("fill business description from br" on Bonterra)', async () => {
    const out = await startFetchThenFill(lead, { message: 'fill bonterra business description from br', conversationId: 'conv-1', mode: 'manual', scope: null, implied: true });
    expect(out?.runId).toBe('drop-1');
    expect(startDrop.mock.calls[0]![1]).toMatchObject({ engagementId: 'eng-b' });
  });

  it('says plainly when the folder cannot be fetched', async () => {
    startDrop.mockResolvedValueOnce({ ok: false, message: 'I cannot find a SharePoint folder for Bonterra.' } as never);
    const out = await startFetchThenFill(lead, { message: PROD, conversationId: 'conv-1', mode: 'manual', scope: null });
    expect(out).toEqual({ line: 'I cannot find a SharePoint folder for Bonterra. Nothing was filled.' });
  });

  it('is not for a client', async () => {
    const client: AuthContext = { userId: 'c', email: 'c@x.test', name: 'C', role: 'client', clientId: 'c-1' };
    expect(await startFetchThenFill(client, { message: PROD, conversationId: 'conv-1', mode: 'manual', scope: null })).toBeNull();
  });
});

const dropState = (extra: Partial<DropState>): DropState => ({
  files: [],
  groups: [],
  unplaced: [],
  progress: { done: 0, total: 0, label: '' },
  instruction: '',
  source: { kind: 'sharepoint', engagementId: 'eng-b', folderName: 'Bonterra' },
  ...extra,
});

describe('fillAfterDrop', () => {
  const scope = { stepIds: ['pre-1', 'pre-2'], label: 'Phase 1 — Name Application' };

  it('starts the fill on the fetched client card with the remembered mode and scope, and posts the fill answer', async () => {
    const state = dropState({
      groups: [
        { engagementId: 'eng-k', companyName: 'Kestrel', changesetId: 'card-k' },
        { engagementId: 'eng-b', companyName: 'Bonterra', changesetId: 'card-b' },
      ],
      fillAfter: { mode: 'manual', scope },
    });
    expect(await fillAfterDrop(lead, { conversationId: 'conv-1', state })).toEqual({ runId: 'fill-1' });
    expect(startFill).toHaveBeenCalledWith(lead, { changesetId: 'card-b', mode: 'manual', conversationId: 'conv-1', scope, everything: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.answer.fill).toEqual({ runId: 'fill-1', mode: 'manual' });
    expect(messages[0]!.text).toMatch(/Name Application only/);
    expect(messages[0]!.text).toMatch(/Fill into app on the card/);
  });

  it('says so plainly when the fetch made no card', async () => {
    expect(await fillAfterDrop(lead, { conversationId: 'conv-1', state: dropState({ fillAfter: { mode: 'auto' } }) })).toEqual({ runId: null });
    expect(startFill).not.toHaveBeenCalled();
    expect(messages[0]!.text).toBe('The folder gave me nothing to put on a card, so nothing was filled.');
    expect(messages[0]!.answer.fill).toBeUndefined();
  });

  it('passes on why the card could not be filled', async () => {
    startFill.mockRejectedValueOnce(new FillRefused('This card has no values for Phase 1 — Name Application, so nothing was filled.'));
    const state = dropState({ groups: [{ engagementId: 'eng-b', companyName: 'Bonterra', changesetId: 'card-b' }], fillAfter: { mode: 'manual', scope } });
    expect(await fillAfterDrop(lead, { conversationId: 'conv-1', state })).toEqual({ runId: null });
    expect(messages[0]!.text).toMatch(/no values for Phase 1/);
  });

  it('does nothing when no fill was asked for, or it was already tried', async () => {
    expect(await fillAfterDrop(lead, { conversationId: 'conv-1', state: dropState({}) })).toBeNull();
    expect(await fillAfterDrop(lead, { conversationId: 'conv-1', state: dropState({ fillAfter: { mode: 'manual', started: true } }) })).toBeNull();
    expect(messages).toHaveLength(0);
  });
});
