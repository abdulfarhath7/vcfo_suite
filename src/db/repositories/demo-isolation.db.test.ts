// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEMO LOGIN ISOLATION — cross-tenant suite against a real Postgres (docs/context/notes/demo-data.md,
 * "Demo logins"). It needs a database with real-looking (non-demo) data and the demo logins:
 *
 *   createdb vcfo_demotest; DATABASE_URL=… npm run db:migrate
 *   DATABASE_URL=… npm run db:seed && npm run db:seed-demo && npm run receivables:seed-demo
 *   DATABASE_URL=… npm run db:seed-demo-logins
 *   DEMO_ISOLATION_DB_URL=postgresql://…/vcfo_demotest npx vitest run src/db/repositories/demo-isolation.db.test.ts
 *
 * Skipped when DEMO_ISOLATION_DB_URL is unset, so `npm run test` never needs a database.
 *
 * What it proves, for the demo lead and the demo client, through the real repositories:
 *   - every engagement, document, task, request, activity, audit event, budget, client member,
 *     receivables sheet and Ask index card they can list belongs to a demo engagement;
 *   - a direct id of a real engagement, document or sheet reads as not found;
 *   - the shared Ask answer cache answers nothing to a demo context.
 * A demo admin or manager gets no context at all (src/auth/guards-demo.test.ts), so no
 * firm-wide repository ever runs for one; the seed creates no such login either.
 */
const URL = process.env.DEMO_ISOLATION_DB_URL;

describe.skipIf(!URL)('demo logins cannot reach real data (real database)', () => {
  type Ctx = import('@/auth/guards').AuthContext;
  let lead: Ctx;
  let client: Ctx;
  let demoIds: Set<string>;
  let realIds: string[];
  let realDocId: string | null;
  let realSheetId: string | null;
  const cardIds: string[] = [];
  let repo: {
    db: typeof import('@/db/client').db;
    schema: typeof import('@/db/schema');
    orm: typeof import('drizzle-orm');
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL;
    const [{ db }, schema, orm] = await Promise.all([import('@/db/client'), import('@/db/schema'), import('drizzle-orm')]);
    repo = { db, schema, orm };
    const { profiles, engagements, documents, receivableSheets, receivableSheetEditors } = schema;
    const { eq, and, notInArray } = orm;
    const people = await db.select().from(profiles).where(eq(profiles.isDemo, true));
    const p = (email: string) => {
      const r = people.find((x) => x.email === email);
      if (!r) throw new Error(`Run npm run db:seed-demo-logins first: ${email} is missing.`);
      return r;
    };
    const l = p('lead@vcfosuite.com');
    const c = p('client@vcfosuite.com');
    lead = { userId: l.id, email: l.email, name: l.name ?? '', role: 'intern', internId: l.internId ?? undefined, demo: true };
    client = { userId: c.id, email: c.email, name: c.name ?? '', role: 'client', clientId: c.clientId ?? undefined, demo: true };
    const all = await db.select({ id: engagements.id, isDemo: engagements.isDemo }).from(engagements);
    demoIds = new Set(all.filter((e) => e.isDemo).map((e) => e.id));
    realIds = all.filter((e) => !e.isDemo).map((e) => e.id);
    if (realIds.length < 3) throw new Error('Seed real-looking data first (npm run db:seed-demo).');
    const [doc] = await db.select({ id: documents.id }).from(documents).where(notInArray(documents.engagementId, [...demoIds])).limit(1);
    realDocId = doc?.id ?? null;
    const editorSheets = await db.select({ id: receivableSheetEditors.sheetId }).from(receivableSheetEditors).where(eq(receivableSheetEditors.userId, l.id));
    const [sheet] = await db
      .select({ id: receivableSheets.id })
      .from(receivableSheets)
      .where(editorSheets.length ? and(notInArray(receivableSheets.id, editorSheets.map((s) => s.id))) : undefined)
      .limit(1);
    realSheetId = sheet?.id ?? null;

    // Ask index cards with the same words on a real and a demo engagement.
    const { systemUpsertIndexItems } = await import('@/db/repositories/ask-index');
    const demoOne = [...demoIds][0]!;
    const realOne = realIds[0]!;
    const card = (engagementId: string, n: number) => {
      const id = `00000000-0000-4000-8000-00000000d0${n}${n}`;
      cardIds.push(id);
      return { sourceKind: 'task' as const, sourceId: id, title: 'Isolation probe zebracorn', cardText: 'zebracorn isolation probe card', engagementId, clientId: null, audience: 'both' as const, contentHash: `probe-${n}` };
    };
    await systemUpsertIndexItems([card(realOne, 1), card(demoOne, 2)]);
  }, 60_000);

  afterAll(async () => {
    if (!repo) return;
    const { askIndexItems } = repo.schema;
    await repo.db.delete(askIndexItems).where(repo.orm.inArray(askIndexItems.sourceId, cardIds));
  });

  const onlyDemo = (ids: Array<string | null | undefined>) => {
    for (const id of ids) if (id) expect(demoIds.has(id), `engagement ${id} is not demo`).toBe(true);
  };

  it('lists only demo engagements', async () => {
    const { listEngagements, listScopedEngagementIds } = await import('@/db/repositories/engagements');
    for (const ctx of [lead, client]) {
      const rows = await listEngagements(ctx);
      expect(rows.length).toBeGreaterThan(0);
      onlyDemo(rows.map((r) => r.id));
      onlyDemo(await listScopedEngagementIds(ctx));
    }
  });

  it('cannot open a real engagement by id or slug', async () => {
    const { assertEngagementAccess } = await import('@/db/repositories/engagements');
    for (const ctx of [lead, client]) {
      for (const id of realIds.slice(0, 10)) {
        const r = await assertEngagementAccess(ctx, id);
        expect(r.ok).toBe(false);
      }
    }
  });

  it('documents: lists demo files only and a real document id is not found', async () => {
    const { listDocuments, getDocumentById } = await import('@/db/repositories/documents');
    for (const ctx of [lead, client]) {
      const docs = await listDocuments(ctx);
      expect(docs.length).toBeGreaterThan(0);
      onlyDemo(docs.map((d) => (d as { engagementId?: string }).engagementId));
      expect(await listDocuments(ctx, realIds[0]!)).toEqual([]);
      if (realDocId) expect(await getDocumentById(ctx, realDocId)).toBeNull();
    }
  });

  it('tasks, requests, activity and audit stay on demo engagements', async () => {
    const { listTasks } = await import('@/db/repositories/tasks');
    const { listDocumentRequests } = await import('@/db/repositories/document-requests');
    const { listActivity } = await import('@/db/repositories/activity');
    const { listAuditEvents } = await import('@/db/repositories/audit-events');
    const tasks = await listTasks(lead);
    expect(tasks.length).toBeGreaterThan(0);
    onlyDemo(tasks.map((t) => (t as { engagementId?: string }).engagementId));
    for (const ctx of [lead, client]) {
      onlyDemo((await listDocumentRequests(ctx)).map((r) => (r as { engagementId?: string }).engagementId));
      onlyDemo((await listActivity(ctx)).map((a) => (a as { engagementId?: string }).engagementId));
      const audit = (await listAuditEvents(ctx, { limit: 500 } as never)) as Array<{ engagementId?: string | null; engagement_id?: string | null }>;
      if (ctx === lead) expect(audit.length).toBeGreaterThan(0);
      onlyDemo(audit.map((a) => a.engagementId ?? a.engagement_id));
    }
  });

  it('client members of a real engagement are refused', async () => {
    const { listEngagementClients } = await import('@/db/repositories/engagement-clients');
    for (const ctx of [lead, client]) {
      await expect(listEngagementClients(ctx, realIds[0]!)).rejects.toThrow();
    }
  });

  it('people lists are refused', async () => {
    const profiles = await import('@/db/repositories/profiles');
    for (const ctx of [lead, client]) {
      await expect(profiles.listStaffPeople(ctx)).rejects.toThrow();
      await expect(profiles.listClientAccounts(ctx)).rejects.toThrow();
      await expect(profiles.listInternOptions(ctx)).rejects.toThrow();
    }
  });

  it('receivables: the demo lead sees the demo sheet only and a real sheet is not found', async () => {
    const { listMySheets, getManagerSheet } = await import('@/db/repositories/receivables');
    const sheets = await listMySheets(lead);
    expect(sheets.map((s) => s.name)).toEqual(['Kaveri Analytics Pvt Ltd']);
    if (realSheetId) await expect(getManagerSheet(lead, realSheetId)).rejects.toThrow();
    await expect(listMySheets(client)).rejects.toThrow();
  });

  it('budgets are on demo engagements only', async () => {
    const { listBudgets } = await import('@/db/repositories/budgets');
    for (const ctx of [lead, client]) {
      const list = await listBudgets(ctx);
      if (ctx === lead) expect(list.length).toBe(2);
      onlyDemo(list.map((b) => (b as { engagementId?: string }).engagementId));
    }
  });

  it('Ask VCFO: index search returns demo cards only, the shared answer cache returns nothing', async () => {
    const { searchIndexItems } = await import('@/db/repositories/ask-index');
    const { findSavedAnswer } = await import('@/db/repositories/ask-saved-answers');
    const hits = await searchIndexItems(lead, { query: 'zebracorn isolation probe', persona: 'staff', limit: 20 });
    expect(hits.length).toBeGreaterThan(0);
    onlyDemo(hits.map((h) => h.engagementId));
    const clientHits = await searchIndexItems(client, { query: 'zebracorn isolation probe', persona: 'client', limit: 20 });
    onlyDemo(clientHits.map((h) => h.engagementId));
    expect(await findSavedAnswer(lead, { questionKey: 'what is gst', audience: 'staff', language: 'en', depth: 'short', knowledgeVersion: 'any' } as never)).toBeNull();
  });

  it('account and user-management writes refuse a demo login', async () => {
    const profiles = await import('@/db/repositories/profiles');
    await expect(profiles.updateOwnPassword(lead, 'Demo@2026', 'Another@2026')).rejects.toThrow('Not available on demo logins');
    await expect(profiles.updateOwnProfile(client, { name: 'Changed' })).rejects.toThrow('Not available on demo logins');
    await expect(profiles.deleteProfileAccount(lead, client.userId)).rejects.toThrow('Not available on demo logins');
    await expect(profiles.updatePersonEmail(lead, client.userId, 'x@vcfosuite.com')).rejects.toThrow('Not available on demo logins');
  });
});
