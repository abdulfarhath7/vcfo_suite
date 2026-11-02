import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { blankNocInput } from '@/lib/registered-office-noc/model';

/**
 * Registered-office NOC — Path A scoping. Every call gates on
 * `assertEngagementAccess` and then touches only the id it approved. A client
 * never reaches the table; a project lead reads but never writes; a manager
 * outside the project gets "not found" with no read, write or audit.
 */

const assertEngagementAccess = vi.fn();
const listScopedEngagementIds = vi.fn();
const recordAuditEvent = vi.fn();

let selectQueue: unknown[][] = [];
const writes: Array<{ kind: string; values?: unknown }> = [];

function selectChain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: () => c,
    limit: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(selectQueue.shift() ?? []),
  };
  return c;
}

function writeChain(kind: string): unknown {
  const w: { kind: string; values?: unknown } = { kind };
  writes.push(w);
  const c: Record<string, unknown> = {
    set: (v: unknown) => {
      w.values = v;
      return c;
    },
    values: (v: unknown) => {
      w.values = v;
      return c;
    },
    where: () => c,
    returning: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve([rowFrom(w.values)]),
  };
  return c;
}

function rowFrom(values: unknown) {
  const v = (values ?? {}) as Record<string, unknown>;
  return {
    engagementId: 'eng-1',
    input: blankNocInput('Acme Private Limited', '2026-10-29'),
    status: 'generated',
    fileName: 'NOC-Acme.docx',
    generatedKey: 'eng-1/registered-office-noc/1-NOC-Acme.docx',
    generatedAt: new Date('2026-10-29T10:00:00Z'),
    generatedBy: 'mgr-1',
    sentAt: null,
    sentBy: null,
    sentTo: null,
    signedKey: null,
    signedFileName: null,
    signedAt: null,
    signedBy: null,
    history: [],
    createdAt: new Date('2026-10-29T10:00:00Z'),
    updatedAt: new Date('2026-10-29T10:00:00Z'),
    ...v,
  };
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => selectChain(),
    insert: () => writeChain('insert'),
    update: () => writeChain('update'),
  },
}));
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('./registered-office-noc');

const manager: AuthContext = { userId: 'mgr-1', email: 'pm@x.in', name: 'Anita Rao', role: 'manager' };
const lead: AuthContext = { userId: 'lead-1', email: 'l@x.in', name: 'Arjun', role: 'intern', internId: 'lead-1' };
const client: AuthContext = { userId: 'cl-1', email: 'c@x.in', name: 'Client', role: 'client', clientId: 'c1' };

const noc = { noc: blankNocInput('Acme Private Limited', '2026-10-29'), fileName: 'NOC-Acme.docx', key: 'k' };

beforeEach(() => {
  selectQueue = [];
  writes.length = 0;
  assertEngagementAccess.mockReset();
  listScopedEngagementIds.mockReset();
  recordAuditEvent.mockReset();
});

describe('registered-office NOC scoping', () => {
  it('a client is refused before any lookup', async () => {
    await expect(repo.getRegisteredOfficeNoc(client, 'eng-1')).rejects.toMatchObject({ status: 404 });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(await repo.listRegisteredOfficeNocs(client)).toEqual([]);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it('a manager outside the project gets not found, and nothing is written or audited', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: 'eng-2', forbidden: true });
    await expect(repo.getRegisteredOfficeNoc(manager, 'eng-2')).rejects.toMatchObject({ status: 404 });
    await expect(repo.saveGeneratedNoc(manager, 'eng-2', noc)).rejects.toMatchObject({ status: 404 });
    await expect(repo.markNocSent(manager, 'eng-2', 'owner')).rejects.toMatchObject({ status: 404 });
    expect(writes).toEqual([]);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('a project lead reads but may not change the NOC', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'eng-1', row: {} });
    selectQueue = [[rowFrom({})]];
    expect((await repo.getRegisteredOfficeNoc(lead, 'eng-1'))?.status).toBe('generated');
    await expect(repo.saveGeneratedNoc(lead, 'eng-1', noc)).rejects.toMatchObject({ status: 403 });
    expect(writes).toEqual([]);
  });

  it('lists only the NOCs of the caller’s scoped engagements', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listRegisteredOfficeNocs(manager)).toEqual([]);
    listScopedEngagementIds.mockResolvedValue(['eng-1']);
    selectQueue = [[rowFrom({})]];
    expect((await repo.listRegisteredOfficeNocs(manager)).map((n) => n.engagementId)).toEqual(['eng-1']);
  });
});

describe('registered-office NOC lifecycle', () => {
  beforeEach(() => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'eng-1', row: {} });
  });

  it('first generation inserts on the approved id and audits it', async () => {
    selectQueue = [[]];
    const out = await repo.saveGeneratedNoc(manager, 'e1', noc);
    expect(writes.map((w) => w.kind)).toEqual(['insert']);
    expect((writes[0]!.values as { engagementId: string }).engagementId).toBe('eng-1');
    expect(out.history.map((h) => h.text)).toEqual(['NOC generated']);
    expect(recordAuditEvent).toHaveBeenCalledWith(manager, expect.objectContaining({ engagementId: 'eng-1', action: 'noc.generated' }));
  });

  it('generating again restarts the signature track and keeps the trail', async () => {
    selectQueue = [[rowFrom({ status: 'signed', signedKey: 's', history: [{ at: 'x', byName: 'A', text: 'NOC generated' }] })]];
    const out = await repo.saveGeneratedNoc(manager, 'eng-1', noc);
    expect(writes.map((w) => w.kind)).toEqual(['update']);
    expect(out.status).toBe('generated');
    expect((writes[0]!.values as { signedKey: unknown }).signedKey).toBeNull();
    expect(out.history.map((h) => h.text)).toEqual(['NOC generated', 'Details changed · NOC generated again']);
  });

  it('cannot mark a NOC sent before it exists, or after it is signed', async () => {
    selectQueue = [[]];
    await expect(repo.markNocSent(manager, 'eng-1', '')).rejects.toMatchObject({ status: 409 });
    selectQueue = [[rowFrom({ status: 'signed' })]];
    await expect(repo.markNocSent(manager, 'eng-1', '')).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual([]);
  });

  it('marks it sent to whoever was typed, the owner by default', async () => {
    selectQueue = [[rowFrom({})]];
    const out = await repo.markNocSent(manager, 'eng-1', '  ');
    expect(out.status).toBe('sent');
    expect(out.sentTo).toBe('the owner');
    expect(out.history.at(-1)?.text).toBe('Sent to the owner for signature');
  });

  it('records the signed copy', async () => {
    selectQueue = [[rowFrom({ status: 'sent' })]];
    const out = await repo.attachSignedNoc(manager, 'eng-1', { key: 'eng-1/registered-office-noc/signed/1-noc.pdf', fileName: 'noc.pdf' });
    expect(out.status).toBe('signed');
    expect(out.signedFileName).toBe('noc.pdf');
    expect(recordAuditEvent).toHaveBeenCalledWith(manager, expect.objectContaining({ action: 'noc.signed' }));
  });
});
