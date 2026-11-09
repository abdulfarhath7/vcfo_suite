// @vitest-environment node
import '../../../scripts/load-env';

import ExcelJS from 'exceljs';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { LlmProvider } from '@/lib/ask/provider';

/**
 * The operations pack on a real Postgres, with nothing mocked between the card and the database: each
 * write action goes preview, card, accept, and undo where it has one. Everything that would reach
 * someone is replaced, and any other network call fails, so this sends nothing to anyone.
 *
 * It changes demo rows freely, so it refuses any database that is not a local copy named `*_eval`:
 *   createdb -T vcfo_pack_ops vcfo_pack_ops_eval
 *   DATABASE_URL=postgresql://.../vcfo_pack_ops_eval ASK_EVAL_OPS=1 npx vitest run tests/ask/evals/ops-cards.test.ts
 * With ASK_EVAL_LIVE=1 and a model key as well, the last suite drives the real router, pick and agent
 * loop, accepts each card and lets the run finish. A plain `npm run test` skips this file.
 */

const outward = vi.hoisted(() => ({
  mail: vi.fn(async (_input: unknown) => ({ ok: true, id: 'eval' })),
  summary: vi.fn(async () => undefined),
  jobs: vi.fn(async () => undefined),
  later: [] as Array<() => Promise<unknown>>,
  files: new Map<string, Buffer>(),
}));

vi.mock('@/lib/email/send-email', () => ({ sendEmail: outward.mail, sendEmailNoLog: outward.mail }));
vi.mock('@/jobs/client', () => ({ inngest: { send: outward.jobs, createFunction: vi.fn() } }));
vi.mock('next/server', async (load) => ({ ...(await load<object>()), after: (work: () => Promise<unknown>) => outward.later.push(work) }));
vi.mock('@/lib/receivables/summary-send', async (load) => ({ ...(await load<object>()), deliverSummary: outward.summary }));
vi.mock('@/db/repositories/outlook-connections', async (load) => ({ ...(await load<object>()), assertOutlookReady: async () => ({ msEmail: 'eval@x.test' }), systemTeamsMeeting: async () => null, systemSendMailAs: outward.mail }));
vi.mock('@/lib/notify/send-whatsapp', async (load) => ({ ...(await load<object>()), queueWhatsAppSend: async () => undefined, queueWhatsAppSends: async () => undefined }));
vi.mock('@/storage/s3', async (load) => ({
  ...(await load<object>()),
  putObject: async (key: string, body: string | Buffer) => void outward.files.set(key, Buffer.from(body)),
  getObjectBuffer: async (key: string) => outward.files.get(key) ?? Buffer.from('eval file'),
  objectExists: async (key: string) => outward.files.has(key),
}));

const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
  const host = new URL(input instanceof Request ? input.url : String(input)).hostname;
  if (host !== 'api.anthropic.com') throw new Error(`This eval makes no call to ${host}.`);
  return realFetch(input, init);
});

const local = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const OPS = process.env.ASK_EVAL_OPS && local?.hostname === 'localhost' && local.pathname.endsWith('_eval');

describe.skipIf(!OPS)('the operations pack through real cards', async () => {
  const { db } = await import('@/db/client');
  const { boardMeetingDocuments, boardMeetings, engagements, labourRegisterBatches, profiles, receivableInvoices, receivableReminders, receivableSheets } = await import('@/db/schema');
  const { createAskRun } = await import('@/db/repositories/ask-runs');
  const { getAskChangesetForDecision } = await import('@/db/repositories/ask-changesets');
  const { getAction } = await import('@/lib/actions/registry');
  const { decideChangeset, ChangesetRefused, undoChangeset } = await import('@/lib/ask/changeset/apply');
  const { createReviewCard } = await import('@/lib/ask/do/card');
  const { reminderDesk } = await import('@/lib/actions/receivables/flows');
  const { listCredits, systemIngestCredits } = await import('@/db/repositories/receivables');
  const { recordUpload, saveColumnMap } = await import('@/db/repositories/labour-registers');
  const { parseWorkbook } = await import('@/lib/labour-registers/parse');
  const { formsFor, requiredFields } = await import('@/lib/labour-registers/catalogue');
  const { listEngagements } = await import('@/db/repositories/engagements');
  const { askRuns } = await import('@/db/schema-ask');
  const { agentResume, agentTurn } = await import('@/lib/ask/agent/loop');
  const { askConfig } = await import('@/lib/ask/config');
  const { handleWork } = await import('@/lib/ask/do/work');
  const { runGuard } = await import('@/lib/ask/guard');
  const { getAskProvider } = await import('@/lib/ask/provider');

  const now = new Date();
  const applied = new Set<string>();
  const person = async (email: string): Promise<AuthContext> => {
    const [row] = await db.select().from(profiles).where(eq(profiles.email, email));
    return { userId: row!.id, email, name: row!.name, role: row!.role as AuthContext['role'] };
  };
  const flush = async () => {
    for (const work of outward.later.splice(0)) await work();
  };

  /** What a person does: reads the card the action drafts, and accepts all of it. */
  async function draftCard(ctx: AuthContext, name: string, input: unknown, engagementId: string | null) {
    const action = (await getAction(name))!;
    applied.add(name);
    expect(action.roles).toContain(ctx.role);
    const run = await createAskRun(ctx, { conversationId: null, workflow: name, goal: name, budgetTokens: 1000 });
    const actx = { auth: ctx, engagementId, conversationId: null, runId: run.id, now, via: 'ask' as const };
    const draft = (await action.preview(actx, action.input.parse(input)))!;
    expect(draft.engagementId).toBe(name.startsWith('receivables.') ? null : engagementId);
    return (await createReviewCard(ctx, draft, { runId: run.id, conversationId: null, companyName: '', now }))!;
  }
  async function accept(ctx: AuthContext, id: string) {
    const found = (await getAskChangesetForDecision(ctx, id))!;
    const result = await decideChangeset(ctx, id, { contentHash: found.changeset.contentHash, accept: found.rows.map((row) => row.id) });
    await flush();
    const after = (await getAskChangesetForDecision(ctx, id))!;
    expect(after.rows.map((row) => row.error ?? row.status)).toEqual(found.rows.map(() => 'applied'));
    return result;
  }
  const viaCard = async (ctx: AuthContext, name: string, input: unknown, engagementId: string | null = null) => {
    const id = await draftCard(ctx, name, input, engagementId);
    await accept(ctx, id);
    return id;
  };
  const undo = async (ctx: AuthContext, id: string) => {
    expect((await undoChangeset(ctx, id)).undone).toBe(1);
    await flush();
  };

  afterEach(() => {
    outward.mail.mockClear();
  });

  // First, because the suites below send the queued reminders that this one asks to skip.
  describe.skipIf(!process.env.ASK_EVAL_LIVE)('with the live router, pick and agent loop', () => {
    const PROJECT = 'demo-northwind-analytics';
    let manager: AuthContext;
    let admin: AuthContext;
    let provider: LlmProvider;
    const spent: string[] = [];

    beforeAll(async () => {
      const [sheet] = await db.select().from(receivableSheets).limit(1);
      manager = await person((await db.select().from(profiles).where(eq(profiles.id, sheet!.managerUserId!)))[0]!.email!);
      admin = await person('admin-nadia@demo.vcfo.local');
      provider = (await getAskProvider())!;
    });

    /** The chat's own path: the router, then the small pick, then a card or a run. */
    async function ask(ctx: AuthContext, message: string, page?: string) {
      const guard = await runGuard(provider, { model: askConfig().models.guard, shell: 'admin', message, history: [], topics: [], metrics: [] });
      const outcome = await handleWork(ctx, { shell: 'admin', page: page ? { path: page } : undefined }, {
        message,
        onScreen: null,
        conversationId: null,
        now: new Date(),
        engagements: async () => (await listEngagements(ctx)).map(({ id, slug, companyName }) => ({ id, slug, companyName })),
        provider: async () => provider,
      });
      console.log(`[ops live] ${JSON.stringify(message)} router=${guard.result.intent} outcome=${outcome.kind}${outcome.kind === 'answer' ? ` path=${outcome.path}: ${outcome.answer.line}` : ''}`);
      return { intent: guard.result.intent, outcome };
    }

    /** What the durable job does, one turn at a time, stopping at a card or the end. */
    async function drive(runId: string) {
      for (let turn = 0; turn < 12; turn += 1) {
        const step = await agentTurn(runId);
        if (step.kind === 'wait') return step.changesetId;
        if (step.kind === 'finished') return null;
      }
      throw new Error('The run did not stop.');
    }
    const runRow = async (runId: string) => (await db.select().from(askRuns).where(eq(askRuns.id, runId)))[0]!;
    const finalLine = async (runId: string) => {
      const row = await runRow(runId);
      spent.push(`${row.turns} turns, ${row.inputTokens} in, ${row.outputTokens} out, ${row.cacheReadTokens} cache read`);
      const last = (row.state as { messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }).messages.at(-1)!;
      return last.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join(' ');
    };
    const rowsOn = async (ctx: AuthContext, id: string) => (await getAskChangesetForDecision(ctx, id))!.rows.map((row) => row.action);
    const started = (outcome: Awaited<ReturnType<typeof ask>>['outcome']) => {
      if (outcome.kind !== 'answer' || outcome.path !== 'agent_run') throw new Error(`Expected a run, got ${JSON.stringify(outcome)}`);
      return outcome.answer.runId!;
    };

    it('routes questions about these records to work, and leaves general questions and other data alone', async () => {
      const route = async (message: string) => (await runGuard(provider, { model: askConfig().models.guard, shell: 'admin', message, history: [], topics: [], metrics: ['Companies incorporated'] })).result.intent;
      const cases: Array<[string, readonly string[]]> = [
        ['Which invoices are overdue?', ['do_work']],
        ['Show me the reminder queue on the receivables sheet.', ['do_work']],
        ['What bank credits are waiting for a decision?', ['do_work']],
        ['What board meetings are coming up for this client?', ['do_work']],
        ['Where does the October labour register batch stand?', ['do_work']],
        ['What is the notice period for a board meeting?', ['explain', 'decision_request']],
        ['What is TDS on a professional invoice?', ['explain']],
        ['How many companies were incorporated this year?', ['fact', 'ops_query']],
        ['Which projects are waiting for my approval?', ['ops_query', 'project_status']],
      ];
      const seen = await Promise.all(cases.map(async ([message]) => route(message)));
      console.log(`[ops live] router: ${JSON.stringify(cases.map(([message], i) => [message, seen[i]]))}`);
      cases.forEach(([message, allowed], i) => expect(allowed, message).toContain(seen[i]));
    }, 120_000);

    it('skips a reminder for a person away from any project, accepts the card, and the run finishes', async () => {
      const { intent, outcome } = await ask(manager, 'Skip the queued reminder for invoice SC/09/02.');
      expect(intent).toBe('do_work');
      const runId = started(outcome);
      expect((await runRow(runId)).engagementId).toBeNull();
      const card = await drive(runId);
      if (!card) throw new Error(`No card: ${await finalLine(runId)}`);
      expect(await rowsOn(manager, card)).toEqual(['receivables.skipReminder']);
      await accept(manager, card);
      expect(await agentResume(runId)).toBe(true);
      expect(await drive(runId)).toBeNull();
      expect((await runRow(runId)).status).toBe('done');
      console.log(`[ops live] final: ${await finalLine(runId)}`);
    }, 180_000);

    it('answers what is overdue with no card', async () => {
      const { intent, outcome } = await ask(manager, 'Which receivables invoices are overdue right now?');
      expect(intent).toBe('do_work');
      const runId = started(outcome);
      expect(await drive(runId)).toBeNull();
      const line = await finalLine(runId);
      console.log(`[ops live] final: ${line}`);
      expect(line).toMatch(/SC\/|overdue/i);
    }, 180_000);

    it('records a receipt by number with no project, and undoes it', async () => {
      const { intent, outcome } = await ask(manager, 'Mark invoice SC/09/05 as paid in full on 5 November 2026.');
      expect(intent).toBe('do_work');
      if (outcome.kind !== 'answer' || !outcome.answer.changesetId) throw new Error(JSON.stringify(outcome));
      expect(outcome.path).toBe('fixed_workflow');
      expect(outcome.answer.line).not.toMatch(/project/i);
      await accept(manager, outcome.answer.changesetId);
      await undo(manager, outcome.answer.changesetId);
    }, 120_000);

    it('sends back a board notice with the board action, not a task and a note', async () => {
      const engagementId = (await db.select().from(engagements).where(eq(engagements.slug, PROJECT)))[0]!.id;
      await viaCard(admin, 'board-meetings.create', { meetingDate: '2027-05-12', meetingTime: '11:00', mode: 'in_person', venue: 'Registered office' }, engagementId);
      const [meeting] = await db.select().from(boardMeetings).where(and(eq(boardMeetings.engagementId, engagementId), eq(boardMeetings.meetingDate, '2027-05-12')));
      await viaCard(admin, 'board-meetings.submit', { meetingId: meeting!.id }, engagementId);

      const { outcome } = await ask(admin, `Send back the board meeting notice ${meeting!.meetingNo}, the venue is wrong.`, `/app/admin/engagements/${PROJECT}`);
      const runId = started(outcome);
      const card = await drive(runId);
      if (!card) throw new Error(`No card: ${await finalLine(runId)}`);
      expect(await rowsOn(admin, card)).toEqual(['board-meetings.sendBack']);
      await accept(admin, card);
      expect(await agentResume(runId)).toBe(true);
      expect(await drive(runId)).toBeNull();
      expect((await db.select().from(boardMeetings).where(eq(boardMeetings.id, meeting!.id)))[0]!.status).toBe('draft');
    }, 180_000);

    it('offers no card to pay a vendor or to finalise a resolution', async () => {
      for (const [ctx, message, page] of [
        [manager, 'Pay the vendor invoice SC/09/04 by bank transfer today.', undefined],
        [admin, 'Finalise and sign the board resolution on the last meeting.', `/app/admin/engagements/${PROJECT}`],
      ] as const) {
        const { outcome } = await ask(ctx, message, page);
        if (outcome.kind !== 'answer') continue;
        expect(outcome.answer.changesetId).toBeUndefined();
        if (outcome.path === 'agent_run') {
          expect(await drive(outcome.answer.runId!)).toBeNull();
          console.log(`[ops live] final: ${await finalLine(outcome.answer.runId!)}`);
        }
      }
    }, 240_000);

    afterAll(() => console.log(`[ops live] runs: ${spent.join(' | ')}`));
  });

  describe('receivables, as the sheet manager, with no project anywhere', () => {
    let manager: AuthContext;
    let sheetId: string;
    let invoiceId: string;
    const invoice = async () => (await db.select().from(receivableInvoices).where(eq(receivableInvoices.id, invoiceId)))[0]!;

    beforeAll(async () => {
      const [sheet] = await db.select().from(receivableSheets).limit(1);
      sheetId = sheet!.id;
      const [row] = await db.select().from(profiles).where(eq(profiles.id, sheet!.managerUserId!));
      manager = await person(row!.email!);
    });

    it('adds an invoice, undoes it, and adds it again', async () => {
      const input = { sheetId, clientName: 'Eval Traders', invoiceNo: 'EVAL/1', invoiceMonth: '2026-10-01', dueDate: '2026-10-20', amountInr: 50000 };
      const first = await viaCard(manager, 'receivables.addInvoice', input);
      const added = (await db.select().from(receivableInvoices).where(and(eq(receivableInvoices.invoiceNo, 'EVAL/1'), isNull(receivableInvoices.deletedAt))))[0]!;
      expect(added.clientName).toBe('Eval Traders');
      await undo(manager, first);
      expect(await db.select().from(receivableInvoices).where(and(eq(receivableInvoices.invoiceNo, 'EVAL/1'), isNull(receivableInvoices.deletedAt)))).toHaveLength(0);
      await viaCard(manager, 'receivables.addInvoice', input);
      invoiceId = (await db.select().from(receivableInvoices).where(and(eq(receivableInvoices.invoiceNo, 'EVAL/1'), isNull(receivableInvoices.deletedAt))))[0]!.id;
    });

    it('updates it and undoes the change', async () => {
      const id = await viaCard(manager, 'receivables.updateInvoice', { invoiceId, amountInr: 60000 });
      expect(Number((await invoice()).amountInr)).toBe(60000);
      await undo(manager, id);
      expect(Number((await invoice()).amountInr)).toBe(50000);
    });

    it('pauses its reminders, disputes it, sets TDS and adds a credit note, each one undone where it can be', async () => {
      const paused = await viaCard(manager, 'receivables.pauseReminders', { invoiceId, until: '2027-01-15', reason: 'Client asked' });
      expect((await invoice()).remindersPausedUntil).toBeTruthy();
      await undo(manager, paused);
      expect((await invoice()).remindersPausedUntil).toBeNull();

      const raised = await viaCard(manager, 'receivables.setDispute', { invoiceId, disputed: true, reason: 'Quantity differs' });
      expect((await invoice()).disputedAt).toBeTruthy();
      await undo(manager, raised);
      expect((await invoice()).disputeResolvedAt).toBeTruthy();

      await viaCard(manager, 'receivables.setTds', { invoiceId, tdsInr: 5000 });
      expect(Number((await invoice()).tdsInr)).toBe(5000);

      const note = await viaCard(manager, 'receivables.addCreditNote', { invoiceId, number: 'EVAL-CN', issuedOn: '2026-10-25', amountInr: 1000, reason: 'Rate' });
      expect(note).toBeTruthy();
    });

    it('records a receipt and undoes it, moving no money', async () => {
      const id = await viaCard(manager, 'receivables.markReceived', { invoiceNo: 'EVAL/1', paidOn: '2026-11-05', amount: 44000 });
      expect((await invoice()).status).toBe('received');
      await undo(manager, id);
      expect((await invoice()).status).toBe('open');
    });

    it('skips a reminder and edits one', async () => {
      // Today's queue, as the Reminders tab shows it: a reminder queued on an earlier day is not on a card.
      const reminders = (await reminderDesk(manager, sheetId)).queue.filter((row) => ['queued', 'held'].includes(row.status)).slice(0, 2);
      expect(reminders.length).toBe(2);
      await viaCard(manager, 'receivables.skipReminder', { sheetId, reminderId: reminders[0]!.id, skipped: true });
      await viaCard(manager, 'receivables.editReminder', { sheetId, reminderId: reminders[1]!.id, subject: 'Payment due', body: 'Please pay the invoice.' });
      const [edited] = await db.select().from(receivableReminders).where(eq(receivableReminders.id, reminders[1]!.id));
      expect(edited!.subjectOverride).toBe('Payment due');
    });

    it('publishes, and the partners are told by code', async () => {
      await viaCard(manager, 'receivables.publish', { sheetId, note: 'Eval' });
      const [sheet] = await db.select().from(receivableSheets).where(eq(receivableSheets.id, sheetId));
      expect(sheet!.publishedVersionId).toBeTruthy();
    });

    it('queues a summary to the list code worked out', async () => {
      outward.summary.mockClear();
      await viaCard(manager, 'receivables.sendSummary', { sheetId, list: 'partners' });
      expect(outward.summary).toHaveBeenCalledTimes(1);
    });

    it('sends the due reminders now, and replies to a partner on an invoice', async () => {
      await viaCard(manager, 'receivables.sendRemindersNow', { sheetId });
      const [partnerInvoice] = await db.select().from(receivableInvoices).where(and(eq(receivableInvoices.sheetId, sheetId), eq(receivableInvoices.status, 'open'), isNotNull(receivableInvoices.partnerId))).limit(1);
      await viaCard(manager, 'receivables.replyToPartner', { invoiceId: partnerInvoice!.id, text: 'We have noted this.' });
      expect(outward.mail).toHaveBeenCalled();
    });

    it('ignores one bank credit, and confirms another against an invoice', async () => {
      const [target] = await db.select().from(receivableInvoices).where(and(eq(receivableInvoices.sheetId, sheetId), eq(receivableInvoices.status, 'open'), isNull(receivableInvoices.deletedAt), isNull(receivableInvoices.disputedAt))).limit(1);
      // An amount no invoice has, so the matcher leaves both credits for a person to decide.
      const credit = (externalRef: string) => ({ source: 'manual' as const, externalRef, valueDate: '2026-11-04', payer: target!.clientName, currency: 'INR', fcAmount: null, inrAmount: 123.45, narration: 'NEFT' });
      await systemIngestCredits(sheetId, [credit(`EVAL-${Date.now()}-A`), credit(`EVAL-${Date.now()}-B`)]);
      const [first, second] = (await listCredits(manager, sheetId)).filter((row) => row.status !== 'confirmed' && row.status !== 'ignored');
      await viaCard(manager, 'receivables.decideCredit', { sheetId, creditId: first!.id, decision: 'ignore' });
      await viaCard(manager, 'receivables.decideCredit', { sheetId, creditId: second!.id, decision: 'confirm', invoiceIds: [target!.id] });
      expect((await listCredits(manager, sheetId)).find((row) => row.id === second!.id)!.status).toBe('confirmed');
    });

    it('holds a firm-wide card for its owner: another manager cannot reach or accept it', async () => {
      const other = await person('pm-anita@demo.vcfo.local');
      const id = await draftCard(manager, 'receivables.setTds', { invoiceId, tdsInr: 100 }, null);
      expect(await getAskChangesetForDecision(other, id)).toBeNull();
      await expect(decideChangeset(other, id, { contentHash: 'x', accept: [] })).rejects.toBeInstanceOf(ChangesetRefused);
    });

    it('deletes an invoice, which has no undo', async () => {
      await viaCard(manager, 'receivables.deleteInvoice', { invoiceId });
      expect((await invoice()).deletedAt).toBeTruthy();
    });
  });

  describe('board meetings, as a firm admin', () => {
    const SLUG = 'demo-northwind-analytics';
    let admin: AuthContext;
    let engagementId: string;
    let meetingId: string;
    const meeting = async () => (await db.select().from(boardMeetings).where(eq(boardMeetings.id, meetingId)))[0]!;

    beforeAll(async () => {
      admin = await person('admin-nadia@demo.vcfo.local');
      engagementId = (await db.select().from(engagements).where(eq(engagements.slug, SLUG)))[0]!.id;
    });

    it('creates a meeting, edits its notice and undoes the edit', async () => {
      await viaCard(admin, 'board-meetings.create', { meetingDate: '2027-04-14', meetingTime: '11:00', mode: 'in_person', venue: 'Registered office' }, engagementId);
      meetingId = (await db.select().from(boardMeetings).where(and(eq(boardMeetings.engagementId, engagementId), eq(boardMeetings.meetingDate, '2027-04-14'))).orderBy(desc(boardMeetings.createdAt)))[0]!.id;
      const id = await viaCard(admin, 'board-meetings.editNotice', { meetingId, meetingTime: '12:00' }, engagementId);
      expect((await meeting()).meetingTime).toMatch(/^12:00/);
      await undo(admin, id);
      expect((await meeting()).meetingTime).toMatch(/^11:00/);
    });

    it('goes to the manager, comes back, goes again, and is approved and sent', async () => {
      await viaCard(admin, 'board-meetings.submit', { meetingId }, engagementId);
      expect((await meeting()).status).toBe('pending_approval');
      await viaCard(admin, 'board-meetings.sendBack', { meetingId, note: 'Fix the venue' }, engagementId);
      expect((await meeting()).status).toBe('draft');
      await viaCard(admin, 'board-meetings.submit', { meetingId }, engagementId);
      await viaCard(admin, 'board-meetings.approve', { meetingId }, engagementId);
      expect((await meeting()).status).toBe('sent');
      expect(outward.mail).toHaveBeenCalled();
    });

    it('reminds the directors, reschedules and cancels', async () => {
      await viaCard(admin, 'board-meetings.remindDirectors', { meetingId }, engagementId);
      await viaCard(admin, 'board-meetings.reschedule', { meetingId, meetingDate: '2027-04-21', meetingTime: '10:00', reason: 'Quorum' }, engagementId);
      expect((await meeting()).meetingDate).toBe('2027-04-21');
      await viaCard(admin, 'board-meetings.cancel', { meetingId, reason: 'Not needed' }, engagementId);
      expect((await meeting()).status).toBe('cancelled');
    });

    it('adds a resolution to a held meeting, rewords it, and sends it for signature without finalising it', async () => {
      const [held] = await db.select().from(boardMeetings).where(and(eq(boardMeetings.engagementId, engagementId), eq(boardMeetings.status, 'held'), isNull(boardMeetings.lockedAt)));
      const fields = { title: 'Open a bank account', description: 'RESOLVED to open an account.', resolutionDate: '2026-11-05' };
      await viaCard(admin, 'board-meetings.addResolution', { meetingId: held!.id, ...fields }, engagementId);
      const [doc] = await db.select().from(boardMeetingDocuments).where(and(eq(boardMeetingDocuments.meetingId, held!.id), eq(boardMeetingDocuments.title, fields.title))).orderBy(desc(boardMeetingDocuments.createdAt));
      await viaCard(admin, 'board-meetings.editResolution', { documentId: doc!.id, ...fields, description: 'RESOLVED to open a current account.' }, engagementId);
      await viaCard(admin, 'board-meetings.sendForSignature', { documentId: doc!.id }, engagementId);
      const [sent] = await db.select().from(boardMeetingDocuments).where(eq(boardMeetingDocuments.id, doc!.id));
      expect(sent!.status).toBe('sent');
      expect(outward.mail).toHaveBeenCalled();
    });
  });

  /** What the upload screen leaves behind: the file, its row, and the columns matched to it. */
  async function uploadPaysheet(ctx: AuthContext, batch: typeof labourRegisterBatches.$inferSelect) {
    // Each person's minimum wage coverage is decided too, because the close blocks while anyone's is not.
    const fields = [...requiredFields(formsFor(batch.stateCode, { from: batch.periodFrom, to: batch.periodTo }, 'state')), 'minimumWageCoverage'];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payroll');
    sheet.addRow(fields);
    sheet.addRow(fields.map((field) => (field === 'minimumWageCoverage' ? 'covered' : 1)));
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const objectKey = `labour/eval/${batch.id}/paysheet.xlsx`;
    outward.files.set(objectKey, bytes);
    const parsed = await parseWorkbook(bytes);
    await recordUpload(ctx, { batchId: batch.id, slot: 'paysheet', fileName: 'paysheet.xlsx', objectKey, sha256: 'eval', sheetName: parsed.sheetName, headerRow: parsed.headerRow, headers: parsed.headers, rowCount: parsed.rows.length });
    await saveColumnMap(ctx, { engagementId: batch.engagementId, slot: 'paysheet', mapping: Object.fromEntries(fields.map((field) => [field, field])), lastHeaders: fields });
  }

  describe('labour registers, as a firm admin', () => {
    it('opens a batch, sets assumptions, closes, builds and reopens', async () => {
      const admin = await person('admin-nadia@demo.vcfo.local');
      const [existing] = await db.select().from(labourRegisterBatches).where(sql`status <> 'attested'`).limit(1);
      const engagementId = existing!.engagementId;
      const batchRow = async (id: string) => (await db.select().from(labourRegisterBatches).where(eq(labourRegisterBatches.id, id)))[0]!;

      await viaCard(admin, 'labour.openBatch', { periodFrom: '2027-01-01', periodTo: '2027-01-31' }, engagementId);
      const opened = (await db.select().from(labourRegisterBatches).where(and(eq(labourRegisterBatches.engagementId, engagementId), eq(labourRegisterBatches.periodFrom, '2027-01-01'))))[0]!;
      expect(opened.stateCode).toBe(existing!.stateCode);

      // The demo batch has its uploads, so it is the one that can close and build.
      const batchId = existing!.id;
      if ((await batchRow(batchId)).markedReadyAt) await viaCard(admin, 'labour.reopen', { batchId, reason: 'Eval start' }, engagementId);
      await uploadPaysheet(admin, existing!);
      await viaCard(admin, 'labour.setAssumptions', { batchId, assumptions: { fullAttendanceAssumed: true, weekOff: 'sun' } }, engagementId);
      await viaCard(admin, 'labour.markReady', { batchId }, engagementId);
      expect((await batchRow(batchId)).markedReadyAt).toBeTruthy();
      const before = outward.files.size;
      await viaCard(admin, 'labour.generate', { batchId }, engagementId);
      expect(outward.files.size).toBeGreaterThan(before);
      await viaCard(admin, 'labour.reopen', { batchId, reason: 'Eval end' }, engagementId);
      expect((await batchRow(batchId)).markedReadyAt).toBeNull();
    }, 120_000);
  });

  it('has put every write action in the pack on a card', async () => {
    const { actionsForRole } = await import('@/lib/actions/registry');
    const writes = (await actionsForRole('super_admin')).filter((action) => /^(board-meetings|receivables|labour)\./.test(action.name) && action.tier !== 'T0');
    expect(writes.length).toBe(31);
    expect(writes.map((action) => action.name).filter((name) => !applied.has(name))).toEqual([]);
  });
});
