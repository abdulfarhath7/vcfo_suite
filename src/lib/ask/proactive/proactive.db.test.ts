// @vitest-environment node
import '../../../../scripts/load-env';

import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { db } from '@/db/client';
import { systemProactiveOwners, type ProactiveOwner } from '@/db/repositories/ask-proactive';
import { systemLoadAskOwner } from '@/db/repositories/ask-runs';
import { askUsageReport } from '@/db/repositories/ask-usage';
import { documentRequests, documents, engagements, notificationDeliveries, notifications, profiles } from '@/db/schema';
import { askChangesetRows, askChangesets, askRuns } from '@/db/schema-ask';
import { documentRequestDetails } from '@/db/schema-portal-documents';
import { regCalendarProposals, regUpdates } from '@/db/schema-watch';
import { clientRecipients } from '@/lib/actions/shared';
import { decideChangeset, rejectChangeset } from '@/lib/ask/changeset/apply';
import { prepareForOwner } from './prepare';

/**
 * The overnight job on a real Postgres with the seeded demo projects: real repositories, real scope,
 * real cards. Run it with `ASK_PROACTIVE_DB=1 npx vitest run src/lib/ask/proactive/proactive.db.test.ts`;
 * a plain `npm run test` skips it because CI has no database. Mail is stopped at the sender, and the test
 * removes everything it made.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const mail = vi.hoisted(() => ({ sendEmail: vi.fn(async () => ({ ok: true })), sendEmailNoLog: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/lib/email/send-email', async (load) => ({ ...(await load<object>()), ...mail }));
vi.mock('@/lib/notify/send-whatsapp', async (load) => ({ ...(await load<object>()), sendWhatsApp: vi.fn(async () => ({ ok: true })) }));

const OLD = new Date('2026-09-01T00:00:00Z');

describe.skipIf(!process.env.ASK_PROACTIVE_DB)('Overnight proposals on the real database', () => {
  const started = new Date();
  let owner: ProactiveOwner;
  let ctx: AuthContext;
  let manager: AuthContext;
  let superAdmin: AuthContext;
  let engagementId: string;
  let requestId: string;
  let documentId: string;
  let updateId: string;
  let proposalId: string;
  let card: { id: string; contentHash: string };

  const scheduleCards = async (userId: string) =>
    db
      .select({ id: askChangesets.id, contentHash: askChangesets.contentHash, status: askChangesets.status, runId: askChangesets.runId, trigger: askRuns.trigger, runStatus: askRuns.status })
      .from(askChangesets)
      .innerJoin(askRuns, eq(askRuns.id, askChangesets.runId))
      .where(and(eq(askChangesets.profileId, userId), eq(askRuns.trigger, 'schedule'), gte(askChangesets.createdAt, started)));
  const rowsOf = (id: string) => db.select().from(askChangesetRows).where(eq(askChangesetRows.changesetId, id));

  beforeAll(async () => {
    vi.stubEnv('ASK_VCFO_ENABLED', 'true');
    vi.stubEnv('ASK_PROACTIVE_ENABLED', 'true');
    vi.stubEnv('WATCH_ENABLED', 'true');
    vi.stubEnv('ASK_KILL_PATHS', '');
    vi.stubEnv('ASK_KILL_TIERS', '');

    const owners = await systemProactiveOwners();
    const leads = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, 'intern'));
    const leadIds = new Set(leads.map((lead) => lead.id));
    for (const candidate of owners.filter((o) => leadIds.has(o.ownerId))) {
      for (const project of candidate.engagements) {
        const [row] = await db.select({ managerId: engagements.managerId }).from(engagements).where(eq(engagements.id, project.id));
        if (!row?.managerId || (await clientRecipients(project.id)).length === 0) continue;
        engagementId = project.id;
        owner = { ownerId: candidate.ownerId, engagements: [project] };
        manager = (await systemLoadAskOwner(row.managerId))!;
      }
    }
    if (!engagementId) throw new Error('No demo lead owns a project with a client login and a manager. Run db:seed-demo first.');
    ctx = (await systemLoadAskOwner(owner.ownerId))!;

    const [top] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.role, 'super_admin'), eq(profiles.status, 'active'))).limit(1);
    superAdmin = (await systemLoadAskOwner(top!.id))!;

    const [request] = await db.insert(documentRequests).values({ engagementId, title: 'Overnight test request', status: 'pending' }).returning({ id: documentRequests.id });
    requestId = request!.id;
    await db.insert(documentRequestDetails).values({ requestId, engagementId, dueOn: '2026-09-15' });
    const [document] = await db.insert(documents).values({ engagementId, fileName: 'overnight-test.pdf', objectKey: 'test/overnight-test.pdf', stepId: 'pre-14', reviewStatus: 'pending', createdAt: OLD }).returning({ id: documents.id });
    documentId = document!.id;
    const [update] = await db.insert(regUpdates).values({ title: 'Overnight test notification', intake: 'manual', status: 'published' }).returning({ id: regUpdates.id });
    updateId = update!.id;
    const [proposal] = await db
      .insert(regCalendarProposals)
      .values({ updateId, obligationId: 'gst-gstr-3b', period: 'Overnight test', oldDueDate: '2026-11-20', newDueDate: '2026-11-25', affectedEngagementIds: [engagementId] })
      .returning({ id: regCalendarProposals.id });
    proposalId = proposal!.id;
  });

  afterAll(async () => {
    const runs = await db.select({ id: askRuns.id }).from(askRuns).where(and(eq(askRuns.workflow, 'proactive'), gte(askRuns.createdAt, started)));
    if (runs.length > 0) {
      await db.delete(askChangesets).where(inArray(askChangesets.runId, runs.map((run) => run.id)));
      await db.delete(askRuns).where(inArray(askRuns.id, runs.map((run) => run.id)));
    }
    await db.delete(notifications).where(and(gte(notifications.createdAt, started), inArray(notifications.userId, [ctx.userId, manager.userId])));
    if (proposalId) await db.delete(regCalendarProposals).where(eq(regCalendarProposals.id, proposalId));
    if (updateId) await db.delete(regUpdates).where(eq(regUpdates.id, updateId));
    if (documentId) await db.delete(documents).where(eq(documents.id, documentId));
    if (requestId) await db.delete(documentRequests).where(eq(documentRequests.id, requestId));
    vi.unstubAllEnvs();
  });

  it('with the flag off, writes nothing at all', async () => {
    vi.stubEnv('ASK_PROACTIVE_ENABLED', 'false');
    expect(await prepareForOwner(owner, new Date())).toEqual({ stopped: 'off' });
    expect(await scheduleCards(ctx.userId)).toEqual([]);
    vi.stubEnv('ASK_PROACTIVE_ENABLED', 'true');
  });

  it('with the kill switch on, writes nothing at all', async () => {
    vi.stubEnv('ASK_KILL_PATHS', 'fixed_workflow');
    expect(await prepareForOwner(owner, new Date())).toEqual({ stopped: 'switched off' });
    expect(await scheduleCards(ctx.userId)).toEqual([]);
    vi.stubEnv('ASK_KILL_PATHS', '');
  });

  it('leaves a proposed card as the lead, and changes nothing else', async () => {
    const result = await prepareForOwner(owner, new Date());
    expect(result).toMatchObject({ cards: 1 });
    const [made] = await scheduleCards(ctx.userId);
    expect(made).toMatchObject({ status: 'proposed', trigger: 'schedule', runStatus: 'waiting_approval' });
    card = made!;
    const rows = await rowsOf(made!.id);
    const targets = rows.map((row) => row.target as Record<string, string>);
    expect(targets).toContainEqual({ itemKey: `request:${requestId}` });
    expect(targets).toContainEqual({ documentId, status: 'approved', reviewAtCard: 'pending ' });
    for (const row of rows) expect(row).toMatchObject({ status: 'proposed', appliedAt: null, undoData: null });

    const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
    expect(document).toMatchObject({ reviewStatus: 'pending', reviewedBy: null });
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect(mail.sendEmailNoLog).not.toHaveBeenCalled();
    const deliveries = await db.select({ n: sql<string>`count(*)` }).from(notificationDeliveries).where(and(eq(notificationDeliveries.eventType, 'client_reminder'), gte(notificationDeliveries.createdAt, started)));
    expect(Number(deliveries[0]!.n)).toBe(0);

    const bell = await db.select().from(notifications).where(and(eq(notifications.userId, ctx.userId), gte(notifications.createdAt, started)));
    expect(bell).toHaveLength(1);
    expect(JSON.stringify(bell[0])).toContain(`changeset=${made!.id}`);
    expect(JSON.stringify(bell[0])).toContain('ask.proposal');
  });

  it('does not propose the same things again the next night', async () => {
    expect(await prepareForOwner(owner, new Date())).toEqual({ cards: 0, rows: 0 });
    expect(await scheduleCards(ctx.userId)).toHaveLength(1);
  });

  it('applies only what a person accepts, and sends the reminder nobody accepted to nobody', async () => {
    const rows = await rowsOf(card.id);
    const review = rows.find((row) => row.action === 'documents.review' && (row.target as { documentId?: string }).documentId === documentId)!;
    const decided = await decideChangeset(ctx, card.id, { contentHash: card.contentHash, accept: [review.id] });
    expect(decided).toBeTruthy();
    const after = await rowsOf(card.id);
    expect(after.find((row) => row.id === review.id)).toMatchObject({ status: 'applied' });
    const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
    expect(document).toMatchObject({ reviewStatus: 'approved', reviewedBy: ctx.userId });
    expect(after.filter((row) => row.action === 'reminders.sendClient').every((row) => row.appliedAt === null)).toBe(true);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('gives a manager a card for a due date change touching their client, which moves nothing until accepted', async () => {
    const result = await prepareForOwner({ ownerId: manager.userId, engagements: [] }, new Date());
    expect(result).toMatchObject({ cards: 1, rows: expect.any(Number) });
    const cards = await scheduleCards(manager.userId);
    const rows = (await Promise.all(cards.map((made) => rowsOf(made.id)))).flat();
    expect(rows.map((row) => row.target)).toContainEqual({ proposalId });
    const [waiting] = await db.select().from(regCalendarProposals).where(eq(regCalendarProposals.id, proposalId));
    expect(waiting).toMatchObject({ status: 'proposed', decidedById: null });
    // Turning the card down leaves the change waiting on the Watch screen: a card is not a decision.
    await rejectChangeset(manager, cards[0]!.id);
    const [still] = await db.select().from(regCalendarProposals).where(eq(regCalendarProposals.id, proposalId));
    expect(still).toMatchObject({ status: 'proposed', decidedById: null });
    expect((await rowsOf(cards[0]!.id)).find((row) => (row.target as { proposalId?: string }).proposalId === proposalId)).toMatchObject({ status: 'skipped' });
  });

  it('moves the date only when the manager accepts, as that manager', async () => {
    const [second] = await db
      .insert(regCalendarProposals)
      .values({ updateId, obligationId: 'gst-gstr-3b', period: 'Overnight test two', oldDueDate: '2026-11-20', newDueDate: '2026-11-26', affectedEngagementIds: [engagementId] })
      .returning({ id: regCalendarProposals.id });
    await prepareForOwner({ ownerId: manager.userId, engagements: [] }, new Date());
    const cards = await scheduleCards(manager.userId);
    const made = cards.find((one) => one.status === 'proposed')!;
    const rows = await rowsOf(made.id);
    const row = rows.find((one) => (one.target as { proposalId?: string }).proposalId === second!.id)!;
    await decideChangeset(manager, made.id, { contentHash: made.contentHash, accept: [row.id] });
    const [decided] = await db.select().from(regCalendarProposals).where(eq(regCalendarProposals.id, second!.id));
    expect(decided).toMatchObject({ status: 'approved', decidedById: manager.userId });
  });

  it('reports what people did with overnight cards, per action', async () => {
    const report = await askUsageReport(superAdmin, { days: 1 });
    const overnight = report.acceptance.filter((row) => row.trigger === 'schedule');
    expect(overnight.find((row) => row.action === 'documents.review')).toMatchObject({ accepted: expect.any(Number) });
    expect(overnight.find((row) => row.action === 'documents.review')!.accepted).toBeGreaterThanOrEqual(1);
    expect(overnight.find((row) => row.action === 'compliance.approveCalendarChange')).toMatchObject({ turnedDown: 1, accepted: 1, acceptedRate: 0.5 });
  });
});
