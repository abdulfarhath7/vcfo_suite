import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/** A run's stream and its undo belong to the person who started it, and show no transcript. */

const me: AuthContext = { userId: 'me', email: 'm@x.test', name: 'Me', role: 'intern' };
const RUN = 'a0000000-0000-4000-8000-00000000000a';
const STEP = 'b0000000-0000-4000-8000-00000000000b';

vi.mock('@/lib/ask/route-guard', () => ({ requireAsk: async () => ({ ok: true, ctx: me }) }));
const ownRun = vi.fn();
const setStatus = vi.fn();
vi.mock('@/db/repositories/ask-runs', () => ({ getOwnAskRun: (...a: unknown[]) => ownRun(...a), setOwnAskRunStepStatus: (...a: unknown[]) => setStatus(...a) }));
const undo = vi.fn(async () => ({ ok: true, summary: 'gone' }) as { ok: boolean; summary?: string; error?: string });
vi.mock('@/lib/actions/registry', () => ({ getAction: async () => ({ undo }) }));

const { GET } = await import('../../../../app/api/ask/runs/[id]/route');
const { POST } = await import('../../../../app/api/ask/runs/[id]/steps/[stepId]/undo/route');

const run = (patch: object = {}) => ({
  run: { id: RUN, status: 'done', engagementId: 'e', conversationId: null, state: { messages: ['the transcript'] }, ...patch },
  line: 'All done.',
  steps: [
    { id: 'm', kind: 'model', name: 'turn', status: 'done' },
    { id: STEP, kind: 'tool', name: 'tasks.addPersonalTodo', label: 'Adding to your own list', status: 'done', changesetId: null, output: { undo: { id: 'w1' } } },
  ],
});
const context = { params: Promise.resolve({ id: RUN }) };
const undoContext = { params: Promise.resolve({ id: RUN, stepId: STEP }) };

beforeEach(() => vi.clearAllMocks());

describe('run routes', () => {
  it('answers 404 for a run that is not this person\'s', async () => {
    ownRun.mockResolvedValue(null);
    expect((await GET(new Request('http://x/'), context)).status).toBe(404);
    expect((await GET(new Request('http://x/'), { params: Promise.resolve({ id: 'nope' }) })).status).toBe(404);
  });

  it('streams the steps a person cares about and the end, never the transcript or a model step', async () => {
    ownRun.mockResolvedValue(run());
    const response = await GET(new Request('http://x/'), context);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    const text = await response.text();
    expect(text).toContain('Adding to your own list');
    expect(text).toContain('All done.');
    expect(text).toContain('event: end');
    expect(text).not.toContain('the transcript');
    expect(text).not.toContain('"turn"');
  });

  it('holds the last word back until the run has ended', async () => {
    const { loadAskRunView } = await import('./view');
    ownRun.mockResolvedValue(run({ status: 'running' }));
    expect((await loadAskRunView(me, RUN))!.line).toBeNull();
  });

  it('undoes one private step as the person, and refuses it twice', async () => {
    ownRun.mockResolvedValue(run());
    expect((await POST(new Request('http://x/'), undoContext)).status).toBe(200);
    expect(undo.mock.calls[0]).toEqual([expect.objectContaining({ auth: me, engagementId: 'e' }), { id: 'w1' }]);
    expect(setStatus).toHaveBeenCalledWith(me, RUN, STEP, 'undone');

    const undone = run();
    undone.steps[1]!.status = 'undone';
    ownRun.mockResolvedValue(undone);
    expect((await POST(new Request('http://x/'), undoContext)).status).toBe(409);
  });

  it('refuses a step of someone else\'s run', async () => {
    ownRun.mockResolvedValue(null);
    expect((await POST(new Request('http://x/'), undoContext)).status).toBe(409);
    expect(undo).not.toHaveBeenCalled();
  });
});
