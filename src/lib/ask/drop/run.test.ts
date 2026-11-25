import { beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import type { AuthContext } from '@/auth/guards';
import type { LlmRequest } from '@/lib/ask/provider';

/**
 * The drop job's steps with the repositories, storage and model replaced by memory: the in-process
 * fallback, the run's token budget, acting as the run's owner, and ZIP unpacking into child rows.
 */

const owner: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'i-1' };

type Row = { id: string; kind: string; fileName: string; s3Key: string | null; sizeBytes: number; status: string; relativePath: string | null; parentId: string | null; runId: string; profileId: string };
let run: Record<string, unknown>;
let rows: Row[];
let objects: Map<string, Buffer>;
let actor: { ctx: AuthContext; run: Record<string, unknown> } | null;
const ctxSeen: AuthContext[] = [];
const messages: Array<{ text: string; answer: { changesetId?: string; runId?: string } }> = [];
let modelUsage = 10;
let nextId = 0;

vi.mock('@/db/repositories/ask-runs', () => ({
  askRunActor: async () => (actor ? { ctx: actor.ctx, run: { ...run } } : null),
  updateAskRun: async (ctx: AuthContext, _id: string, patch: Record<string, unknown>) => {
    ctxSeen.push(ctx);
    Object.assign(run, patch);
  },
  appendAskRunStep: async () => undefined,
}));
vi.mock('@/db/repositories/ask-attachments', () => ({
  listAskRunAttachments: async (ctx: AuthContext) => {
    ctxSeen.push(ctx);
    return rows.filter((r) => r.profileId === ctx.userId);
  },
  getOwnAskAttachments: async (ctx: AuthContext, ids: string[]) => rows.filter((r) => ids.includes(r.id) && r.profileId === ctx.userId),
  updateOwnAskAttachment: async (_ctx: AuthContext, id: string, patch: Partial<Row>) => {
    Object.assign(rows.find((r) => r.id === id)!, patch);
  },
  createAskAttachment: async (ctx: AuthContext, input: Partial<Row>) => {
    const row = { id: `child-${(nextId += 1)}`, status: 'uploaded', relativePath: null, parentId: null, profileId: ctx.userId, ...input } as Row;
    rows.push(row);
    return row;
  },
}));
vi.mock('@/db/repositories/ask-messages', () => ({
  appendAskMessage: async (_ctx: AuthContext, _conversationId: string, input: { text: string; answer: { changesetId?: string } }) => {
    messages.push(input as never);
    return { id: 'msg-1' };
  },
}));
let earlierCards: Array<{ id: string; engagementId: string; companyName: string; attachmentIds: string[] }> = [];
vi.mock('@/db/repositories/ask-changesets', () => ({ listAskRunChangesets: async () => earlierCards }));
vi.mock('@/db/repositories/ask-usage', () => ({ systemTodayTokenTotal: async () => 0, systemRecordAskUsage: async () => undefined }));
vi.mock('@/lib/ask/rate-limit', () => ({ checkAskRateLimit: async () => ({ ok: true }) }));
vi.mock('@/storage/s3', () => ({
  getObjectBuffer: async (key: string) => objects.get(key) ?? null,
  putObject: async (key: string, body: Buffer | string) => {
    objects.set(key, Buffer.isBuffer(body) ? body : Buffer.from(body));
  },
}));
const modelSaw: string[] = [];
vi.mock('@/lib/ask/provider', async (load) => ({
  ...(await load<object>()),
  getAskProvider: async () => ({
    name: 'mock',
    complete: async (req: LlmRequest) => (modelSaw.push(JSON.stringify(req.messages)), {
      model: req.model,
      content: [{ type: 'text', text: JSON.stringify({ docType: 'other', company: 'Acme', values: [{ label: 'Name', value: 'Asha', page: 1, person: null, confidence: 1 }] }) }],
      stopReason: 'end_turn',
      usage: { inputTokens: modelUsage, outputTokens: modelUsage, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }),
  }),
}));
// Reading is the data router's own; here it is a stub that spends tokens through the run's provider.
vi.mock('@/lib/ask/data-router/read', async (load) => {
  const real = await load<typeof import('@/lib/ask/data-router/read')>();
  const read = async (deps: { provider: () => Promise<{ complete: (r: LlmRequest) => Promise<unknown> }>; model: string }, text = '') => {
    const provider = await deps.provider();
    await provider.complete({ model: deps.model, system: [], messages: text ? [{ role: 'user', content: text }] : [] } as unknown as LlmRequest);
    return { docType: 'other', company: 'Acme', values: [{ label: 'Name', value: 'Asha', page: 1, person: null, confidence: 1 }], sensitive: false, usedModel: true };
  };
  return { ...real, readFile: async (_f: unknown, deps: never) => read(deps), readPaste: async (t: string, deps: never) => read(deps, t) };
});
const assemble = vi.fn(async (input: { files: Array<Record<string, unknown>>; reads: unknown[] }) => ({
  groups: input.reads.length > 0 ? [{ engagementId: 'eng-1', companyName: 'Acme', changesetId: 'd0000000-0000-4000-8000-00000000000d' }] : [],
  unplaced: [],
  files: input.files.map((f) => (f.status === 'read' ? { ...f, status: 'placed' } : f)),
  notes: [],
}));
vi.mock('./assemble', () => ({ assembleDrop: (input: never) => assemble(input) }));
const send = vi.fn(async () => {
  throw new Error('no inngest');
});
vi.mock('@/jobs/client', () => ({ inngest: { send: (...a: unknown[]) => send(...(a as [])) } }));

const pullSharepointFiles = vi.fn();
vi.mock('./sharepoint-pull', () => ({ COPY_LABEL: 'Copying files from SharePoint', pullSharepointFiles: (...a: unknown[]) => pullSharepointFiles(...a) }));

const pullAppDocuments = vi.fn();
vi.mock('./app-docs-pull', () => ({ APP_COPY_LABEL: 'Gathering the documents in the app', pullAppDocuments: (...a: unknown[]) => pullAppDocuments(...a) }));

const findCachedRead = vi.fn(async (..._a: unknown[]): Promise<string | null> => null);
const markRead = vi.fn();
vi.mock('@/db/repositories/sharepoint-files-seen', () => ({
  findCachedSharepointRead: (...a: unknown[]) => findCachedRead(...a),
  markSharepointFileRead: (...a: unknown[]) => markRead(...a),
}));

const fillAfterDrop = vi.fn(async (..._a: unknown[]) => ({ runId: 'fill-1' as string | null }));
vi.mock('@/lib/ask/fill/after-fetch', () => ({ fillAfterDrop: (...a: unknown[]) => fillAfterDrop(...a) }));

const { queueAskDrop, runAskDrop, dropUnpackStep, dropStatus, dropFinishStep, readProgressLabel } = await import('./run');

function file(id: string, fileName: string, data: Buffer | Uint8Array, extra: Partial<Row> = {}): Row {
  const key = `k/${id}/${fileName}`;
  objects.set(key, Buffer.from(data));
  return { id, kind: 'file', fileName, s3Key: key, sizeBytes: data.length, status: 'uploaded', relativePath: null, parentId: null, runId: 'run-1', profileId: owner.userId, ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  objects = new Map();
  ctxSeen.length = 0;
  messages.length = 0;
  modelUsage = 10;
  nextId = 0;
  modelSaw.length = 0;
  vi.unstubAllEnvs();
  earlierCards = [];
  run = { id: 'run-1', workflow: 'drop', status: 'queued', conversationId: 'conv-1', budgetTokens: 400_000, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, state: { files: [], groups: [], unplaced: [], progress: { done: 0, total: 0, label: '' }, instruction: 'fill this in for Acme' } };
  rows = [file('a-1', 'notes.txt', Buffer.from('Name: Asha')), file('a-2', 'pan.pdf', Buffer.from('%PDF'), { relativePath: 'Acme/KYC/pan.pdf' })];
  actor = { ctx: owner, run };
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('queueAskDrop', () => {
  it('runs the drop in this process when Inngest is not reachable', async () => {
    expect(await queueAskDrop('run-1', { profileId: owner.userId })).toBe('inline');
    await flush();
    expect(send).toHaveBeenCalledWith({ name: 'ask/drop.run', data: { runId: 'run-1', profileId: owner.userId } });
    expect(run.status).toBe('waiting_approval');
    const state = run.state as { files: Array<{ status: string; path: string }>; groups: unknown[]; answerMessageId?: string };
    expect(state.files.map((f) => [f.path, f.status])).toEqual([
      ['notes.txt', 'placed'],
      ['Acme/KYC/pan.pdf', 'placed'],
    ]);
    expect(state.answerMessageId).toBe('msg-1');
    expect(messages[0]!.answer.changesetId).toBe('d0000000-0000-4000-8000-00000000000d');
    expect(messages[0]!.text).toMatch(/card for Acme/);
  });
});

describe('runAskDrop from SharePoint', () => {
  it('copies the folder in first, as the owner, then reads and sorts it like a dropped folder', async () => {
    rows = [];
    run.state = { ...(run.state as object), source: { kind: 'sharepoint', engagementId: 'eng-1', folderName: 'Acme' } };
    pullSharepointFiles.mockImplementation(async (ctx: AuthContext) => {
      rows.push(file('sp-1', 'pan.pdf', Buffer.from('%PDF'), { relativePath: 'Acme/KYC/pan.pdf', profileId: ctx.userId }));
      return { copied: 1, skipped: [{ attachmentId: 'sharepoint:x', path: 'Acme/plan.dwg', size: 3, status: 'skipped', reason: 'not read' }] };
    });
    await runAskDrop('run-1');
    expect(pullSharepointFiles).toHaveBeenCalledTimes(1);
    expect(pullSharepointFiles.mock.calls[0]![0]).toBe(owner);
    expect(run.status).toBe('waiting_approval');
    const state = run.state as { files: Array<{ path: string; status: string }>; source: { pulled?: boolean } };
    expect(state.source.pulled).toBe(true);
    expect(state.files.map((f) => [f.path, f.status])).toEqual([
      ['Acme/KYC/pan.pdf', 'placed'],
      ['Acme/plan.dwg', 'skipped'],
    ]);
    expect(messages[0]!.text).toMatch(/card for Acme/);
    expect(messages[0]!.text).toMatch(/Acme\/plan\.dwg \(not read\)/);
  });

  it('reuses a stored read of the same bytes, with no model call, and marks each new read', async () => {
    rows = [];
    run.state = { ...(run.state as object), source: { kind: 'sharepoint', engagementId: 'eng-1', folderName: 'Acme' } };
    pullSharepointFiles.mockImplementation(async (ctx: AuthContext) => {
      rows.push(file('sp-1', 'pan.pdf', Buffer.from('%PDF'), { relativePath: 'Acme/KYC/pan.pdf', profileId: ctx.userId }));
      rows.push(file('sp-2', 'coi.pdf', Buffer.from('%PDF-2'), { relativePath: 'Acme/coi.pdf', profileId: ctx.userId }));
      return { copied: 2, skipped: [] };
    });
    objects.set('reads/earlier', Buffer.from(JSON.stringify({ docType: 'pan_card', company: 'Acme', values: [], sensitive: true, usedModel: true })));
    findCachedRead.mockImplementation(async (_ctx, _eng, attachmentId) => (attachmentId === 'sp-1' ? 'reads/earlier' : null));
    await runAskDrop('run-1');
    expect(modelSaw).toHaveLength(1);
    expect(markRead.mock.calls.map((c) => [c[1], c[2]])).toEqual([['eng-1', 'sp-1'], ['eng-1', 'sp-2']]);
    const state = run.state as { files: Array<{ path: string; docType?: string }> };
    expect(state.files.find((f) => f.path === 'Acme/KYC/pan.pdf')?.docType).toBe('pan_card');
  });

  it('reads SharePoint and the documents in the app in one fetch, reusing stored reads and taking only their values (PLAN M3-M5)', async () => {
    rows = [];
    run.state = { ...(run.state as object), source: { kind: 'sharepoint', engagementId: 'eng-1', folderName: 'Acme', appDocs: true } };
    pullSharepointFiles.mockImplementation(async (ctx: AuthContext) => {
      rows.push(file('sp-1', 'moa.pdf', Buffer.from('%PDF'), { relativePath: 'Acme/moa.pdf', profileId: ctx.userId }));
      // Read in an earlier fetch and unchanged: a row with no bytes.
      rows.push({ ...file('st-1', 'pan.pdf', Buffer.from('')), s3Key: null, relativePath: 'Acme/KYC/pan.pdf', profileId: ctx.userId });
      return { copied: 1, skipped: [], stored: [{ attachmentId: 'st-1', path: 'Acme/KYC/pan.pdf', size: 4, status: 'queued', origin: 'stored' }] };
    });
    pullAppDocuments.mockImplementation(async (ctx: AuthContext) => {
      rows.push(file('app-1', 'board-resolution.docx', Buffer.from('PK'), { relativePath: 'In the app/Board resolution (final)/board-resolution.docx', profileId: ctx.userId }));
      return { files: [{ attachmentId: 'app-1', path: 'In the app/Board resolution (final)/board-resolution.docx', size: 2, status: 'queued', origin: 'app' }], reused: 0 };
    });
    objects.set('reads/earlier', Buffer.from(JSON.stringify({ docType: 'pan_card', company: 'Acme', values: [{ label: 'PAN', value: 'ABCDE1234F', page: 1, person: 'Asha Rao', confidence: 1 }], parts: [], sensitive: true, usedModel: true })));
    findCachedRead.mockImplementation(async (_ctx, _eng, attachmentId) => (attachmentId === 'st-1' ? 'reads/earlier' : null));
    await runAskDrop('run-1');
    expect(pullAppDocuments).toHaveBeenCalledTimes(1);
    expect(pullAppDocuments.mock.calls[0]![0]).toBe(owner);
    // Two files are read by the model; the stored one costs nothing and needs no bytes.
    expect(modelSaw).toHaveLength(2);
    const call = assemble.mock.calls[0]![0] as unknown as { reads: Array<{ attachment: { id: string }; result: { values: unknown[] } }>; valuesOnly?: Set<string>; overrides?: Map<string, { engagementId: string }> };
    expect(call.reads.map((r) => r.attachment.id).sort()).toEqual(['app-1', 'sp-1', 'st-1']);
    expect(call.reads.find((r) => r.attachment.id === 'st-1')!.result.values).toHaveLength(1);
    expect([...(call.valuesOnly ?? [])].sort()).toEqual(['app-1', 'st-1']);
    expect(call.overrides?.get('app-1')).toEqual({ engagementId: 'eng-1' });
    const state = run.state as { source: { pulled?: boolean; appPulled?: boolean }; files: Array<{ attachmentId: string; origin?: string; ms?: number; values?: number }> };
    expect(state.source).toMatchObject({ pulled: true, appPulled: true });
    expect(state.files.find((f) => f.attachmentId === 'app-1')).toMatchObject({ origin: 'app', values: 1 });
    expect(typeof state.files.find((f) => f.attachmentId === 'sp-1')?.ms).toBe('number');
  });

  it('reads only the documents in the app when SharePoint is not read', async () => {
    rows = [];
    run.state = { ...(run.state as object), source: { kind: 'sharepoint', engagementId: 'eng-1', folderName: '', sharepoint: false, appDocs: true, companyName: 'Acme' } };
    pullAppDocuments.mockImplementation(async (ctx: AuthContext) => {
      rows.push(file('app-1', 'moa.pdf', Buffer.from('%PDF'), { relativePath: 'In the app/MOA/moa.pdf', profileId: ctx.userId }));
      return { files: [{ attachmentId: 'app-1', path: 'In the app/MOA/moa.pdf', size: 4, status: 'queued', origin: 'app' }], reused: 0 };
    });
    await runAskDrop('run-1');
    expect(pullSharepointFiles).not.toHaveBeenCalled();
    expect(run.status).toBe('waiting_approval');
  });

  it('starts the fill the request asked for once the card is ready, once only', async () => {
    rows = [];
    const scope = { stepIds: ['pre-1'], label: 'Phase 1 — Name Application' };
    run.state = { ...(run.state as object), source: { kind: 'sharepoint', engagementId: 'eng-1', folderName: 'Acme' }, fillAfter: { mode: 'manual', scope } };
    pullSharepointFiles.mockImplementation(async (ctx: AuthContext) => {
      rows.push(file('sp-1', 'pan.pdf', Buffer.from('%PDF'), { relativePath: 'Acme/KYC/pan.pdf', profileId: ctx.userId }));
      return { copied: 1, skipped: [] };
    });
    await runAskDrop('run-1');
    expect(fillAfterDrop).toHaveBeenCalledTimes(1);
    const [ctx, input] = fillAfterDrop.mock.calls[0] as [AuthContext, { conversationId: string; state: { groups: Array<{ changesetId: string }>; fillAfter: unknown } }];
    expect(ctx).toBe(owner);
    expect(input.conversationId).toBe('conv-1');
    expect(input.state.groups[0]!.changesetId).toBe('d0000000-0000-4000-8000-00000000000d');
    expect(input.state.fillAfter).toMatchObject({ mode: 'manual', scope });
    expect(run.status).toBe('waiting_approval');
    expect((run.state as { fillAfter: unknown }).fillAfter).toEqual({ mode: 'manual', scope, started: true, runId: 'fill-1' });
    // A retry of the finish step does not start it again.
    run.status = 'running';
    await dropFinishStep('run-1');
    expect(fillAfterDrop).toHaveBeenCalledTimes(1);
  });

  it('settles the drop even when the fill after it throws', async () => {
    run.state = { ...(run.state as object), fillAfter: { mode: 'auto' } };
    fillAfterDrop.mockRejectedValueOnce(new Error('boom'));
    await runAskDrop('run-1');
    expect(run.status).toBe('waiting_approval');
    expect((run.state as { fillAfter: unknown }).fillAfter).toEqual({ mode: 'auto', started: true });
  });

  it('does not copy the folder again once it is pulled, and does nothing for an upload', async () => {
    run.state = { ...(run.state as object), source: { kind: 'sharepoint', engagementId: 'eng-1', folderName: 'Acme', pulled: true } };
    await runAskDrop('run-1');
    run = { ...run, status: 'queued', state: { files: [], groups: [], unplaced: [], progress: { done: 0, total: 0, label: '' }, instruction: '' } };
    actor = { ctx: owner, run };
    await runAskDrop('run-1');
    expect(pullSharepointFiles).not.toHaveBeenCalled();
  });
});

describe('runAskDrop privacy', () => {
  it('masks a pasted text before the model reads it, and makes no call with client data off', async () => {
    const paste = 'Director name: Asha Rao\nPAN ABCDE1234F\nAadhaar 2345 6789 0123\nEmail asha.rao@example.com\nMobile +91 98765 43210';
    rows = [file('a-1', 'Pasted text', Buffer.from(paste), { kind: 'paste' })];
    await runAskDrop('run-1');
    expect(modelSaw.length).toBeGreaterThan(0);
    const seen = modelSaw.join('\n');
    for (const raw of ['ABCDE1234F', '2345 6789 0123', 'asha.rao@example.com', '98765 43210', 'Asha Rao']) expect(seen).not.toContain(raw);
    expect(seen).toContain('[PAN_1]');

    modelSaw.length = 0;
    vi.stubEnv('ASK_CLIENT_DATA_ENABLED', 'false');
    run = { ...run, status: 'queued', state: { files: [], groups: [], unplaced: [], progress: { done: 0, total: 0, label: '' }, instruction: 'fill this in for Acme' } };
    actor = { ctx: owner, run };
    rows = [file('a-1', 'Pasted text', Buffer.from(paste), { kind: 'paste' })];
    await runAskDrop('run-1');
    expect(modelSaw).toEqual([]);
    const files = (run.state as { files: Array<{ status: string; reason?: string }> }).files;
    expect(files[0]).toMatchObject({ status: 'failed', reason: expect.stringMatching(/switched off/) });
  });
});

describe('runAskDrop', () => {
  it('acts only as the run owner, rebuilt from the run', async () => {
    await runAskDrop('run-1');
    expect(ctxSeen.length).toBeGreaterThan(0);
    expect(ctxSeen.every((c) => c === owner)).toBe(true);
  });

  it('does nothing when the owner can no longer be rebuilt', async () => {
    actor = null;
    expect(await runAskDrop('run-1')).toBeNull();
    expect(ctxSeen).toEqual([]);
    expect(messages).toEqual([]);
  });

  it('stops at the token budget, keeps what it prepared and lists what it did not read', async () => {
    run.budgetTokens = 30;
    // Three files are read at once, so the first batch still starts in full (60 tokens); the fourth,
    // in the next batch, is over the budget and is not read.
    modelUsage = 10;
    rows.push(file('a-3', 'third.txt', Buffer.from('x')));
    rows.push(file('a-4', 'fourth.txt', Buffer.from('x')));
    await runAskDrop('run-1');
    expect(run.status).toBe('over_budget');
    const state = run.state as { files: Array<{ path: string; status: string; reason?: string }>; overBudget?: boolean; groups: unknown[] };
    expect(state.overBudget).toBe(true);
    expect(state.groups).toHaveLength(1);
    expect(state.files.find((f) => f.path === 'third.txt')).toMatchObject({ status: 'placed' });
    expect(state.files.find((f) => f.path === 'fourth.txt')).toMatchObject({ status: 'skipped' });
    expect(messages[0]!.text).toMatch(/Not read: fourth\.txt/);
  });

  it('keeps the cards an earlier try made and sorts only the other files', async () => {
    earlierCards = [{ id: 'e0000000-0000-4000-8000-00000000000e', engagementId: 'eng-1', companyName: 'Acme', attachmentIds: ['a-1'] }];
    await runAskDrop('run-1');
    const call = assemble.mock.calls[0]![0] as unknown as { reads: Array<{ attachment: { id: string } }>; groups?: unknown[] };
    expect(call.reads.map((r) => r.attachment.id)).toEqual(['a-2']);
    expect(call.groups).toEqual([{ engagementId: 'eng-1', companyName: 'Acme', changesetId: 'e0000000-0000-4000-8000-00000000000e' }]);
    const state = run.state as { files: Array<{ attachmentId: string; status: string }> };
    expect(state.files.find((f) => f.attachmentId === 'a-1')).toMatchObject({ status: 'placed' });
  });

  it('waits for the where reply even when the drop ran over budget', () => {
    const base = { files: [], groups: [], progress: { done: 0, total: 0, label: '' }, instruction: '' };
    expect(dropStatus({ ...base, overBudget: true, unplaced: [{ attachmentId: 'x', path: 'x.pdf', reason: 'r' }] } as never)).toBe('waiting_reply');
    expect(dropStatus({ ...base, overBudget: true, unplaced: [] } as never)).toBe('over_budget');
  });

  it('unpacks a ZIP into child rows with their folder paths, once', async () => {
    const zip = zipSync({ 'Payroll/Aug-2026/pay.csv': strToU8('a,b\n1,2'), 'old.xls': strToU8('x'), '__MACOSX/x': strToU8('x') });
    rows = [file('z-1', 'Acme.zip', zip)];
    const first = await dropUnpackStep('run-1');
    const child = rows.find((r) => r.parentId === 'z-1')!;
    expect(child.relativePath).toBe('Acme/Payroll/Aug-2026/pay.csv');
    expect(first).toEqual([child.id]);
    const state = run.state as { files: Array<{ path: string; status: string; reason?: string }> };
    expect(state.files.find((f) => f.path === 'Acme/old.xls')).toMatchObject({ status: 'skipped' });
    // A retry of the step does not unpack again.
    await dropUnpackStep('run-1');
    expect(rows.filter((r) => r.parentId === 'z-1')).toHaveLength(1);
  });
});

describe('readProgressLabel', () => {
  it('says how far the reading is and what the last file gave', () => {
    expect(readProgressLabel(12, 50, { values: 3, docType: 'board_resolution' })).toBe('Read 12 of 50 · 3 values from the board resolution');
    expect(readProgressLabel(1, 2, { values: 1, docType: 'other' })).toBe('Read 1 of 2 · 1 value');
    expect(readProgressLabel(2, 2, { values: 0 })).toBe('Read 2 of 2');
  });
});
