import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope } from '@/data/assist/schema';

/**
 * Cross-tenant rules for the Assist tables (Path A — enforced here, not RLS):
 *   - managers and Project Leads are refused before any query runs,
 *   - conversations, messages and library items are private to one profile,
 *   - a client conversation / library item needs an engagement the caller can
 *     access, and is written against the approved id,
 *   - knowledge sources are admin / super only; client retrieval never
 *     widens to staff-only sources.
 */

const assertEngagementAccess = vi.fn();
const dbSelect = vi.fn();
const dbInsert = vi.fn();
const dbUpdate = vi.fn();
const dbDelete = vi.fn();
let lastWhere: SQL | undefined;
let selectRows: unknown[] = [];
let inserted: Record<string, unknown> | null = null;

vi.mock('@/db/client', () => ({
  db: {
    select: (...args: unknown[]) => dbSelect(...args),
    insert: (...args: unknown[]) => dbInsert(...args),
    update: (...args: unknown[]) => dbUpdate(...args),
    delete: (...args: unknown[]) => dbDelete(...args),
  },
}));

vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
}));

const conversations = await import('@/db/repositories/assist-conversations');
const messages = await import('@/db/repositories/assist-messages');
const library = await import('@/db/repositories/client-library');
const documents = await import('@/db/repositories/assist-documents');
const { AssistForbiddenError } = await import('@/lib/assist/access');

const dialect = new PgDialect();
function whereParams(): unknown[] {
  if (!lastWhere) return [];
  return dialect.sqlToQuery(lastWhere).params;
}

function ctx(role: AuthContext['role'], userId: string): AuthContext {
  return { userId, email: `${userId}@x.test`, name: userId, role };
}
const clientA = ctx('client', 'user-client-a');
const clientB = ctx('client', 'user-client-b');
const admin = ctx('admin', 'user-admin');
const superAdmin = ctx('super_admin', 'user-super');
const manager = ctx('manager', 'user-manager');
const lead = ctx('intern', 'user-lead');

const ENG_A = '11111111-1111-1111-1111-111111111111';
const ENG_B = '22222222-2222-2222-2222-222222222222';

const answer: AnswerEnvelope = {
  line: 'GST is a tax.',
  citations: [{ id: 'gst-portal', label: 'GST portal' }],
  actions: ['save'],
  origin: 'reviewed',
  depth: 'normal',
};

beforeEach(() => {
  vi.clearAllMocks();
  lastWhere = undefined;
  selectRows = [];
  inserted = null;
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: (w: SQL) => {
      lastWhere = w;
      return chain;
    },
    orderBy: () => chain,
    limit: () => Promise.resolve(selectRows),
    then: (resolve: (v: unknown[]) => unknown) => resolve(selectRows),
  };
  dbSelect.mockImplementation(() => chain);
  dbInsert.mockImplementation(() => ({
    values: (values: Record<string, unknown>) => {
      inserted = values;
      return { returning: () => Promise.resolve([{ id: 'new-row', ...values }]) };
    },
  }));
  dbUpdate.mockImplementation(() => ({
    set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
  }));
  dbDelete.mockImplementation(() => ({
    where: (w: SQL) => {
      lastWhere = w;
      return { returning: () => Promise.resolve([]) };
    },
  }));
});

describe('role gate', () => {
  it.each([manager, lead])('refuses $role before touching the database', async (who) => {
    await expect(conversations.createAssistConversation(who, { shell: 'admin' })).rejects.toBeInstanceOf(
      AssistForbiddenError,
    );
    await expect(conversations.getAssistConversation(who, 'c-1')).rejects.toBeInstanceOf(AssistForbiddenError);
    await expect(library.listLibraryItems(who)).rejects.toBeInstanceOf(AssistForbiddenError);
    await expect(
      library.saveLibraryItem(who, { engagementId: ENG_A, title: 't', category: 'tax', answer }),
    ).rejects.toBeInstanceOf(AssistForbiddenError);
    await expect(documents.listAssistDocuments(who)).rejects.toBeInstanceOf(AssistForbiddenError);
    await expect(
      documents.searchAssistChunks(who, { query: 'gst', persona: 'staff', limit: 5 }),
    ).rejects.toBeInstanceOf(AssistForbiddenError);
    expect(dbSelect).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('keeps each role to its own shell', async () => {
    await expect(conversations.createAssistConversation(clientA, { shell: 'admin' })).rejects.toBeInstanceOf(
      AssistForbiddenError,
    );
    await expect(
      conversations.createAssistConversation(admin, { shell: 'client', engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(AssistForbiddenError);
    expect(dbInsert).not.toHaveBeenCalled();
  });
});

describe('conversations', () => {
  it('refuses a client conversation on an engagement the client cannot see', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: ENG_B, forbidden: true });
    await expect(
      conversations.createAssistConversation(clientA, { shell: 'client', engagementId: ENG_B }),
    ).resolves.toBeNull();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('writes the approved engagement id and the caller as owner', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: ENG_A, row: {} });
    await conversations.createAssistConversation(clientA, { shell: 'client', engagementId: 'eng-a-app-id' });
    expect(inserted).toMatchObject({ profileId: clientA.userId, engagementId: ENG_A, shell: 'client', role: 'client' });
  });

  it('lets super admin preview a client shell for one accessible engagement', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: ENG_B, row: {} });
    await conversations.createAssistConversation(superAdmin, { shell: 'client', engagementId: ENG_B });
    expect(inserted).toMatchObject({ profileId: superAdmin.userId, engagementId: ENG_B, shell: 'client' });
  });

  it("scopes reads to the caller's profile — client B cannot read client A's thread", async () => {
    selectRows = [];
    await expect(conversations.getAssistConversation(clientB, 'conv-of-a')).resolves.toBeNull();
    expect(whereParams()).toContain(clientB.userId);
    expect(whereParams()).not.toContain(clientA.userId);
  });

  it('does not append to a conversation the caller does not own', async () => {
    selectRows = [];
    await expect(
      messages.appendAssistMessage(clientB, 'conv-of-a', { sender: 'user', text: 'hi' }),
    ).resolves.toBeNull();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('even a firm admin cannot read a client conversation', async () => {
    selectRows = [];
    await expect(conversations.getAssistConversation(admin, 'conv-of-a')).resolves.toBeNull();
    expect(whereParams()).toContain(admin.userId);
  });
});

describe('client library', () => {
  it('lists only the caller’s items', async () => {
    await library.listLibraryItems(clientB);
    expect(whereParams()).toEqual([clientB.userId]);
  });

  it('only a client saves; super admin preview is read-only', async () => {
    await expect(
      library.saveLibraryItem(superAdmin, { engagementId: ENG_A, title: 't', category: 'tax', answer }),
    ).rejects.toBeInstanceOf(AssistForbiddenError);
    await expect(library.deleteLibraryItem(admin, 'item-1')).rejects.toBeInstanceOf(AssistForbiddenError);
  });

  it('refuses to save against another client’s engagement', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: ENG_B, forbidden: true });
    await expect(
      library.saveLibraryItem(clientA, { engagementId: ENG_B, title: 't', category: 'tax', answer }),
    ).resolves.toBeNull();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('saves against the approved engagement for the caller', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: ENG_A, row: {} });
    await library.saveLibraryItem(clientA, {
      engagementId: ENG_A,
      title: 'GST basics',
      category: 'tax',
      answer,
      topicSlug: 'gst-basics',
      topicVersion: 2,
    });
    expect(inserted).toMatchObject({
      profileId: clientA.userId,
      engagementId: ENG_A,
      topicSlug: 'gst-basics',
      sourceVersion: 2,
    });
  });

  it('delete is scoped to the caller', async () => {
    await expect(library.deleteLibraryItem(clientB, 'item-of-a')).resolves.toBe(false);
    expect(whereParams()).toContain(clientB.userId);
  });
});

describe('knowledge sources', () => {
  it('clients cannot list or upload sources', async () => {
    await expect(documents.listAssistDocuments(clientA)).rejects.toBeInstanceOf(AssistForbiddenError);
    await expect(
      documents.createAssistDocument(clientA, { title: 'x', sourceType: 'firm_note', audience: 'both' }),
    ).rejects.toBeInstanceOf(AssistForbiddenError);
  });

  it('admin and super admin can', async () => {
    await expect(documents.listAssistDocuments(admin)).resolves.toEqual([]);
    await expect(documents.listAssistDocuments(superAdmin)).resolves.toEqual([]);
  });

  it('client retrieval never reaches staff-only sources, even if it asks for staff persona', async () => {
    await documents.searchAssistChunks(clientA, { query: 'gst threshold', persona: 'staff', limit: 5 });
    const params = whereParams();
    expect(params).toContain('client');
    expect(params).toContain('both');
    expect(params).not.toContain('staff');
  });

  it('staff retrieval includes staff sources', async () => {
    await documents.searchAssistChunks(admin, { query: 'gst threshold', persona: 'staff', limit: 5 });
    expect(whereParams()).toContain('staff');
  });
});
