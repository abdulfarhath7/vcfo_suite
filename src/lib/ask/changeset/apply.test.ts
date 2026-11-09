import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { changesetHash } from './hash';

/**
 * The approval rules, with the repository and the registry replaced. What must hold: nothing runs
 * unless the hash matches and the claim succeeds, the checks run again at the click, only the right
 * person decides, and a T4 action never executes from a card.
 */

const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern' };
const manager: AuthContext = { userId: 'mgr-1', email: 'm@x.test', name: 'Manager', role: 'manager' };

const execute = vi.fn();
const recheck = vi.fn();
const undo = vi.fn();
const action = { name: 'checklist.setResponse', tier: 'T2', roles: ['super_admin', 'admin', 'manager', 'intern'], input: z.object({ stepId: z.string(), fieldId: z.string(), value: z.string() }).passthrough(), recheck, execute, undo };
const actions: Record<string, unknown> = { 'checklist.setResponse': action };
const noteDecision = vi.fn(async () => null as string | null);
const sendEvent = vi.fn(async () => undefined);
vi.mock('@/db/repositories/ask-runs', () => ({ systemNoteAskRunDecision: (...a: unknown[]) => noteDecision(...(a as [])) }));
vi.mock('@/jobs/client', () => ({ inngest: { send: (...a: unknown[]) => sendEvent(...(a as [])) } }));
vi.mock('@/lib/actions/registry', () => ({ getAction: async (name: string) => actions[name] ?? null }));

const claim = vi.fn();
const setStatus = vi.fn();
const updateRows = vi.fn();
let found: unknown = null;
vi.mock('@/db/repositories/ask-changesets', () => ({
  getAskChangesetForDecision: vi.fn(async () => found),
  claimAskChangeset: (...a: unknown[]) => claim(...a),
  setAskChangesetStatus: (...a: unknown[]) => setStatus(...a),
  updateAskChangesetRows: (...a: unknown[]) => updateRows(...a),
  rowNeedsManager: (row: { target: { needsManager?: boolean } }) => row.target.needsManager === true,
}));
const audit = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => audit(...a) }));

const { ChangesetRefused, decideChangeset, editChangesetRow, rejectChangeset, undoChangeset } = await import('./apply');

const makeRow = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  action: 'checklist.setResponse',
  target: { stepId: 'pre-15', fieldId: id },
  newValue: `value-${id}`,
  label: id,
  status: 'proposed',
  undoData: null,
  ...patch,
});

function setCard(rows: ReturnType<typeof makeRow>[], extra: Record<string, unknown> = {}) {
  const contentHash = changesetHash(rows.map((r) => ({ action: r.action, target: r.target as never, newValue: r.newValue as never })));
  found = {
    changeset: { id: 'cs-1', status: 'proposed', contentHash, expiresAt: new Date(Date.now() + 86_400_000), engagementId: 'eng-1', conversationId: null, runId: 'run-1', decidedById: null },
    rows,
    companyName: 'Acme',
    viewerId: 'lead-1',
    owner: true,
    manager: false,
    ...extra,
  };
  return contentHash;
}

const passes = { checks: [{ rule: 'gate', ok: true }], heldReason: null, canApply: true, oldValue: '', value: 'v', displayOld: '', displayNew: 'v', sensitive: false };

beforeEach(() => {
  vi.clearAllMocks();
  actions['checklist.setResponse'] = action;
  action.tier = 'T2';
  claim.mockResolvedValue(true);
  recheck.mockResolvedValue(passes);
  execute.mockResolvedValue({ ok: true, summary: 'saved', undo: { previous: '' } });
  undo.mockResolvedValue({ ok: true, summary: 'undone' });
});

describe('decideChangeset', () => {
  it('saves the accepted rows only, as the person who clicked, with audit', async () => {
    const hash = setCard([makeRow('a'), makeRow('b')]);
    const result = await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] });
    expect(result).toEqual({ applied: 1, failed: 0, held: 0 });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0]).toMatchObject({ auth: lead, via: 'ask', runId: 'run-1' });
    expect(setStatus.mock.calls[0]![2]).toBe('partly_applied');
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'ask.changeset.applied', metadata: { via: 'ask', changesetId: 'cs-1', runId: 'run-1' } });
    // The audit line names fields, never values.
    expect(JSON.stringify(audit.mock.calls[0]![1])).not.toContain('value-a');
  });

  it('refuses a hash that does not match what was shown, before anything runs', async () => {
    setCard([makeRow('a')]);
    await expect(decideChangeset(lead, 'cs-1', { contentHash: 'f'.repeat(64), accept: ['a'] })).rejects.toBeInstanceOf(ChangesetRefused);
    expect(claim).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses when a stored value no longer matches the stored hash', async () => {
    const hash = setCard([makeRow('a')]);
    (found as { rows: Array<{ newValue: string }> }).rows[0]!.newValue = 'tampered';
    await expect(decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).rejects.toBeInstanceOf(ChangesetRefused);
    expect(execute).not.toHaveBeenCalled();
  });

  it('runs nothing when another click already claimed the card', async () => {
    const hash = setCard([makeRow('a')]);
    claim.mockResolvedValue(false);
    await expect(decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).rejects.toThrow(/already been decided/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('checks again at the click: a step locked since the proposal holds the row', async () => {
    const hash = setCard([makeRow('a')]);
    recheck.mockResolvedValue({ ...passes, canApply: false, heldReason: 'Held: the step closed.', checks: [{ rule: 'gate', ok: false, message: 'Held: the step closed.' }] });
    const result = await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] });
    expect(result.held).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(updateRows.mock.calls[0]![2][0].patch).toMatchObject({ status: 'held', heldReason: 'Held: the step closed.' });
    expect(audit).not.toHaveBeenCalled();
  });

  it('runs no row for a person whose role the action does not take, on any card', async () => {
    const hash = setCard([makeRow('a')]);
    const client = { ...lead, role: 'client' as const };
    const result = await decideChangeset(client, 'cs-1', { contentHash: hash, accept: ['a'] });
    expect(execute).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it('refuses an expired card', async () => {
    const hash = setCard([makeRow('a')]);
    (found as { changeset: { expiresAt: Date } }).changeset.expiresAt = new Date(Date.now() - 1000);
    await expect(decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).rejects.toThrow(/expired/);
    expect(setStatus.mock.calls[0]![2]).toBe('expired');
  });

  it('refuses a card already decided', async () => {
    const hash = setCard([makeRow('a', { status: 'applied' })]);
    (found as { changeset: { status: string } }).changeset.status = 'applied';
    await expect(decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).rejects.toThrow(/already been decided/);
  });

  it('leaves a manager-only row to the manager, even from the lead who prepared the card', async () => {
    const hash = setCard([makeRow('a', { target: { stepId: 'pre-2', fieldId: 'a', needsManager: true } })]);
    await expect(decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).rejects.toThrow(/manager/);
    expect(execute).not.toHaveBeenCalled();
    (found as { owner: boolean; manager: boolean; viewerId: string }).owner = false;
    (found as { owner: boolean; manager: boolean; viewerId: string }).manager = true;
    await decideChangeset(manager, 'cs-1', { contentHash: hash, accept: ['a'] });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0].auth).toBe(manager);
  });

  it('wakes the agent run behind the card, and never fails the decision if that does not work', async () => {
    setCard([makeRow('a')]);
    noteDecision.mockResolvedValueOnce('agent');
    claim.mockResolvedValue(true);
    execute.mockResolvedValue({ ok: true, summary: 'done' });
    recheck.mockResolvedValue({ canApply: true, checks: [], heldReason: null });
    const hash = (found as { changeset: { contentHash: string } }).changeset.contentHash;
    await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] });
    expect(sendEvent).toHaveBeenCalledWith({ name: 'ask/changeset.decided', data: { changesetId: 'cs-1', runId: 'run-1' } });
    noteDecision.mockRejectedValueOnce(new Error('down'));
    setCard([makeRow('b')]);
    const again = (found as { changeset: { contentHash: string } }).changeset.contentHash;
    await expect(decideChangeset(lead, 'cs-1', { contentHash: again, accept: ['b'] })).resolves.toMatchObject({ applied: 1 });
  });

  it('wakes the run on a rejection too, and closes the rows left open', async () => {
    setCard([makeRow('a')]);
    noteDecision.mockResolvedValueOnce('agent');
    await rejectChangeset(lead, 'cs-1');
    expect(updateRows.mock.calls.at(-1)![2]).toEqual([{ id: 'a', patch: { status: 'skipped' } }]);
    expect(sendEvent).toHaveBeenCalledTimes(1);
  });

  it('lets a manager reject only the rows a manager decides, and leaves the lead\'s own rows open', async () => {
    setCard([makeRow('a', { target: { stepId: 'pre-2', fieldId: 'a', needsManager: true } }), makeRow('b')], { owner: false, manager: true, viewerId: 'mgr-1' });
    await rejectChangeset(manager, 'cs-1');
    expect(updateRows.mock.calls.at(-1)![2]).toEqual([{ id: 'a', patch: { status: 'skipped' } }]);
    expect(setStatus).not.toHaveBeenCalled();
    expect(noteDecision).toHaveBeenCalledWith('run-1', false);
    // The lead who asked may still withdraw every row, the manager's one included.
    setCard([makeRow('a', { target: { stepId: 'pre-2', fieldId: 'a', needsManager: true } }), makeRow('b')]);
    await rejectChangeset(lead, 'cs-1');
    expect(updateRows.mock.calls.at(-1)![2].map((r: { id: string }) => r.id)).toEqual(['a', 'b']);
    expect(setStatus.mock.calls.at(-1)![2]).toBe('rejected');
  });

  it('refuses a person who is neither owner nor manager on the card', async () => {
    found = null;
    await expect(decideChangeset(lead, 'cs-1', { contentHash: 'x'.repeat(64), accept: ['a'] })).rejects.toMatchObject({ status: 404 });
  });

  describe('the people a T3 card names', () => {
    const asha = { name: 'Asha', email: 'Asha@x.test', role: 'Director' };
    const ravi = { name: 'Ravi', email: 'ravi@x.test', role: 'Director' };
    const preview = vi.fn();
    const send = async (onCard: unknown[]) => {
      const hash = setCard([makeRow('a')]);
      (found as { changeset: Record<string, unknown> }).changeset.tier = 'T3';
      (found as { changeset: Record<string, unknown> }).changeset.recipients = onCard;
      return decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] });
    };

    beforeEach(() => {
      (action as Record<string, unknown>).preview = preview;
      preview.mockReset();
    });

    it('sends nothing when someone new would get it, and says who', async () => {
      preview.mockResolvedValue({ recipients: [asha, ravi] });
      expect(await send([asha])).toEqual({ applied: 0, failed: 1, held: 0 });
      expect(execute).not.toHaveBeenCalled();
      expect(updateRows.mock.calls[0]![2][0].patch.error).toMatch(/Ravi would also get it/);
    });

    it('goes ahead for the same people, in any letter case, and when someone has left the list', async () => {
      preview.mockResolvedValue({ recipients: [{ ...asha, email: 'asha@X.TEST' }] });
      expect(await send([asha, ravi])).toEqual({ applied: 1, failed: 0, held: 0 });
    });

    it('fails the row with the action\'s own sentence when it now refuses', async () => {
      const { ActionRefused } = await import('@/lib/actions/shared');
      preview.mockRejectedValue(new ActionRefused('That meeting was cancelled.'));
      expect(await send([asha])).toEqual({ applied: 0, failed: 1, held: 0 });
      expect(execute).not.toHaveBeenCalled();
      expect(updateRows.mock.calls[0]![2][0].patch.error).toBe('That meeting was cancelled.');
    });
  });

  it('stops a card whose action an owner\'s flag has since switched off', async () => {
    (action as Record<string, unknown>).available = () => false;
    const hash = setCard([makeRow('a')]);
    expect(await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).toEqual({ applied: 0, failed: 1, held: 0 });
    expect(execute).not.toHaveBeenCalled();
    delete (action as Record<string, unknown>).available;
  });

  it('does not leave a card stuck when a check throws at the click', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    recheck.mockRejectedValue(new Error('database down'));
    const hash = setCard([makeRow('a')]);
    expect(await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] })).toEqual({ applied: 0, failed: 1, held: 0 });
    expect(setStatus).toHaveBeenCalled();
    error.mockRestore();
  });

  it('never executes a T4 action from a card', async () => {
    action.tier = 'T4';
    const hash = setCard([makeRow('a')]);
    const result = await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a'] });
    expect(result.failed).toBe(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps going past one failed row and reports it', async () => {
    const hash = setCard([makeRow('a'), makeRow('b')]);
    execute.mockResolvedValueOnce({ ok: false, error: 'No' }).mockResolvedValueOnce({ ok: true, summary: 'saved' });
    const result = await decideChangeset(lead, 'cs-1', { contentHash: hash, accept: ['a', 'b'] });
    expect(result).toEqual({ applied: 1, failed: 1, held: 0 });
    expect(setStatus.mock.calls[0]![2]).toBe('partly_applied');
  });
});

describe('editChangesetRow', () => {
  it('stores the checked shape, recomputes the hash and saves nothing to the step', async () => {
    setCard([makeRow('a')]);
    recheck.mockResolvedValue({ ...passes, value: 'ABCDE1234F' });
    await editChangesetRow(lead, 'cs-1', 'a', 'abcde1234f');
    expect(execute).not.toHaveBeenCalled();
    const [, , updates, hash] = updateRows.mock.calls[0]!;
    expect(updates[0].patch.newValue).toBe('ABCDE1234F');
    // The acceptance report counts a row accepted with edits apart from one accepted as proposed.
    expect(updates[0].patch.editedAt).toBeInstanceOf(Date);
    expect(hash).toBe(changesetHash([{ action: 'checklist.setResponse', target: { stepId: 'pre-15', fieldId: 'a' }, newValue: 'ABCDE1234F' }]));
  });

  it('refuses an edit of a row that is not yours', async () => {
    setCard([makeRow('a', { target: { stepId: 'pre-2', fieldId: 'a', needsManager: true } })]);
    await expect(editChangesetRow(lead, 'cs-1', 'a', 'x')).rejects.toMatchObject({ status: 403 });
  });

  it('releases a later row once the answer it waits for is given', async () => {
    setCard([makeRow('parent', { newValue: '' }), makeRow('child', { status: 'held' })]);
    recheck.mockImplementation(async (_a, input, pending) => {
      const released = input.fieldId !== 'child' || pending.parent === 'yes';
      return { ...passes, value: input.value, heldReason: released ? null : 'Held', canApply: released };
    });
    await editChangesetRow(lead, 'cs-1', 'parent', 'yes');
    const child = updateRows.mock.calls[0]![2].find((u: { id: string }) => u.id === 'child');
    expect(child.patch).toMatchObject({ status: 'proposed', heldReason: null });
  });
});

describe('undoChangeset', () => {
  it('undoes newest first and reports a value changed since', async () => {
    setCard([makeRow('a', { status: 'applied', undoData: { n: 1 } }), makeRow('b', { status: 'applied', undoData: { n: 2 } })]);
    undo.mockResolvedValueOnce({ ok: false, error: 'Changed since.' }).mockResolvedValueOnce({ ok: true, summary: 'done' });
    const result = await undoChangeset(lead, 'cs-1');
    expect(undo.mock.calls[0]![1]).toEqual({ n: 2 });
    expect(result).toEqual({ undone: 1, kept: ['b: Changed since.'] });
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('marks the card undone when everything came back, with audit', async () => {
    setCard([makeRow('a', { status: 'applied', undoData: { n: 1 } })]);
    await undoChangeset(lead, 'cs-1');
    expect(setStatus.mock.calls[0]![2]).toBe('undone');
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'ask.changeset.undone' });
  });

  it('refuses someone who could not approve any of the saved rows', async () => {
    setCard([makeRow('a', { status: 'applied', undoData: {} })], { owner: false, manager: true });
    await expect(undoChangeset(manager, 'cs-1')).rejects.toMatchObject({ status: 403 });
  });

  it('undoes each row with the right to approve it, whoever clicked last', async () => {
    const managerRow = makeRow('a', { status: 'applied', undoData: { n: 1 }, target: { stepId: 'pre-2', fieldId: 'a', needsManager: true } });
    const leadRow = makeRow('b', { status: 'applied', undoData: { n: 2 } });
    // The lead decided last, yet the manager's row is the manager's to put back, and the lead's row stays.
    setCard([managerRow, leadRow], { owner: false, manager: true, viewerId: 'mgr-1' });
    (found as { changeset: { decidedById: string } }).changeset.decidedById = 'lead-1';
    expect(await undoChangeset(manager, 'cs-1')).toEqual({ undone: 1, kept: [] });
    expect(undo.mock.calls.map((call) => call[1])).toEqual([{ n: 1 }]);
    expect(setStatus).not.toHaveBeenCalled();
    // The lead who prepared the card cannot reverse the manager's approval.
    vi.clearAllMocks();
    setCard([managerRow]);
    await expect(undoChangeset(lead, 'cs-1')).rejects.toMatchObject({ status: 403 });
    expect(undo).not.toHaveBeenCalled();
  });
});
