import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * SPICe+ attachments repository: staff only, scoped through `getDocPackInputs` (so an engagement
 * outside the caller's scope is refused), and the NOC facts come from the NOC state.
 */

vi.mock('server-only', () => ({}));

let access: unknown = { ok: false, status: 404, error: 'not_found' };
let noc: unknown = null;
vi.mock('@/db/repositories/doc-pack', () => ({ getDocPackInputs: vi.fn(async () => access) }));
vi.mock('@/db/repositories/board-resolution-noc', () => ({ getNocState: vi.fn(async () => noc) }));

const { getSpiceAttachments, nocFacts } = await import('./spice-attachments');
const docPack = await import('@/db/repositories/doc-pack');

const ctx = (role: string): AuthContext => ({ userId: 'u1', role, email: 'a@b.c', name: 'A' }) as unknown as AuthContext;

beforeEach(() => {
  access = { ok: false, status: 404, error: 'not_found' };
  noc = null;
  vi.mocked(docPack.getDocPackInputs).mockClear();
});

describe('getSpiceAttachments', () => {
  it('refuses a client and a developer without reading the engagement', async () => {
    expect(await getSpiceAttachments(ctx('client'), 'e1')).toEqual({ ok: false, status: 403, error: 'forbidden' });
    expect(await getSpiceAttachments(ctx('developer'), 'e1')).toEqual({ ok: false, status: 403, error: 'forbidden' });
    expect(docPack.getDocPackInputs).not.toHaveBeenCalled();
  });

  it('passes on the scope refusal for an engagement the lead does not hold', async () => {
    access = { ok: false, status: 403, error: 'forbidden' };
    expect(await getSpiceAttachments(ctx('intern'), 'e1')).toEqual({ ok: false, status: 403, error: 'forbidden' });
  });

  it('derives the list for staff in scope, with the accepted copy', async () => {
    access = {
      ok: true,
      inputs: { dbId: 'e1', engagement: { companyName: 'Acme' }, checklistState: {}, brRow: null },
    };
    noc = { accepted: true, track: [{ key: 'drafted', done: true }], staff: { vaultDocumentId: 'doc-1' } };
    const out = await getSpiceAttachments(ctx('manager'), 'e1');
    expect(out.ok).toBe(true);
    if (out.ok) {
      const br = out.list.items.find((it) => it.key === 'board-resolution');
      expect(br?.status).toBe('done');
      expect(br?.vaultDocumentId).toBe('doc-1');
    }
  });
});

describe('nocFacts', () => {
  it('reads the track and the vault id', () => {
    expect(nocFacts(null)).toBeNull();
    expect(
      nocFacts({ accepted: false, track: [{ key: 'released', done: true }, { key: 'signed', done: true }] } as never),
    ).toEqual({ drafted: true, signed: true, accepted: false, vaultDocumentId: null });
  });
});
