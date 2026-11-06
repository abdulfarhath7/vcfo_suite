// @vitest-environment node
import '../../../../scripts/load-env';

import { and, eq, isNull, ne } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import { db } from '@/db/client';
import {
  complianceChecklistChecks,
  complianceInstanceDetails,
  complianceInstances,
  complianceInstanceWorkflow,
  complianceObligations,
  complianceReminderOverrides,
  complianceReminders,
  complianceSubjectFields,
  complianceTasks,
  documentRequests,
  engagementLeads,
  engagements,
  filingEvents,
  itemWindowRequests,
  profiles,
} from '@/db/schema';
import { createTask } from '@/db/repositories/compliance-tasks';
import { STAGE_LABEL } from '@/lib/compliance-tasks/model';
import { getAction } from '../registry';
import type { ActionContext, ActionResult } from '../types';

/**
 * The compliance and registration actions on a real Postgres with the seeded demo projects, so the
 * real repositories decide who may do what. Run it with
 * `ASK_ACTIONS_DB=1 npx vitest run src/lib/actions/compliance/compliance.db.test.ts`; a plain
 * `npm run test` skips it because CI has no database. It works on one unfiled period of one demo
 * client, and removes or restores everything it touched.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

type Run = { auth: AuthContext; client?: string };

describe.skipIf(!process.env.ASK_ACTIONS_DB)('Compliance and registration actions on the real database', () => {
  let client: string;
  let otherClient: string;
  let filing: string;
  let saved: { windowFrom: string | null; windowTo: string | null; status: string; filedOn: string | null };
  let taskId: string;
  let manager: AuthContext;
  let lead: AuthContext;
  let foreignManager: AuthContext;
  let foreignLead: AuthContext;
  let admin: AuthContext;
  let clientUser: AuthContext;
  let developer: AuthContext;

  const person = (row: { id: string; email: string | null; name: string | null; internId: string | null; clientId: string | null }, role: AppRole): AuthContext => ({
    userId: row.id,
    email: row.email ?? '',
    name: row.name ?? role,
    role,
    ...(row.internId ? { internId: row.internId } : {}),
    ...(row.clientId ? { clientId: row.clientId } : {}),
  });
  const context = ({ auth, client: locked }: Run): ActionContext => ({ auth, engagementId: locked ?? client, conversationId: null, runId: null, now: new Date(), via: 'ask' });

  async function action(name: string) {
    const found = await getAction(name);
    if (!found) throw new Error(`No action ${name}`);
    return found;
  }

  /** What the card does: parse, preview without writing, then run as the person who clicked. */
  async function approve(run: Run, name: string, input: unknown): Promise<ActionResult> {
    const found = await action(name);
    const parsed = found.input.parse(input);
    await found.preview(context(run), parsed);
    return found.execute(context(run), parsed);
  }
  const execute = async (run: Run, name: string, input: unknown) => {
    const found = await action(name);
    return found.execute(context(run), found.input.parse(input));
  };
  const undo = async (run: Run, name: string, outcome: ActionResult) => {
    expect(outcome, name).toMatchObject({ ok: true });
    return (await action(name)).undo!(context(run), (outcome as unknown as { undo: never }).undo);
  };
  const read = async <T>(run: Run, name: string, input: unknown): Promise<T> => {
    const outcome = await execute(run, name, input);
    expect(outcome, name).toMatchObject({ ok: true });
    return JSON.parse((outcome as { summary: string }).summary) as T;
  };
  const fetchInstance = async () => (await db.select().from(complianceInstances).where(eq(complianceInstances.id, filing)).limit(1))[0]!;

  async function cleanup(): Promise<void> {
    if (filing) {
      await db.delete(complianceChecklistChecks).where(eq(complianceChecklistChecks.subjectKey, filing));
      await db.delete(complianceSubjectFields).where(eq(complianceSubjectFields.subjectKey, filing));
      await db.delete(complianceInstanceDetails).where(eq(complianceInstanceDetails.instanceId, filing));
      await db.delete(complianceInstanceWorkflow).where(eq(complianceInstanceWorkflow.instanceId, filing));
      await db.delete(complianceReminderOverrides).where(eq(complianceReminderOverrides.subjectId, filing));
      await db.delete(complianceReminders).where(eq(complianceReminders.instanceId, filing));
      await db.delete(filingEvents).where(eq(filingEvents.instanceId, filing));
      await db.delete(itemWindowRequests).where(eq(itemWindowRequests.itemKey, `filing:${filing}`));
      await db.update(complianceInstances).set(saved).where(eq(complianceInstances.id, filing));
    }
    if (client) {
      await db.delete(documentRequests).where(and(eq(documentRequests.engagementId, client), eq(documentRequests.title, 'zz-pack bank statement')));
    }
    if (taskId) await db.delete(complianceTasks).where(eq(complianceTasks.id, taskId));
  }

  beforeAll(async () => {
    const [row] = await db
      .select({ id: engagements.id, managerId: engagements.managerId, clientUserId: engagements.clientUserId, internId: engagementLeads.internId })
      .from(engagements)
      .innerJoin(engagementLeads, eq(engagementLeads.engagementId, engagements.id))
      .innerJoin(complianceInstances, and(eq(complianceInstances.engagementId, engagements.id), isNull(complianceInstances.filedOn)))
      .where(isNull(engagements.deletedAt))
      .limit(1);
    client = row!.id;
    const [other] = await db.select({ id: engagements.id }).from(engagements).where(and(isNull(engagements.deletedAt), ne(engagements.id, client), ne(engagements.managerId, row!.managerId!))).limit(1);
    otherClient = other!.id;
    const [instance] = await db
      .select({ id: complianceInstances.id, windowFrom: complianceInstances.windowFrom, windowTo: complianceInstances.windowTo, status: complianceInstances.status, filedOn: complianceInstances.filedOn })
      .from(complianceInstances)
      .innerJoin(complianceObligations, eq(complianceObligations.id, complianceInstances.obligationId))
      .where(and(eq(complianceInstances.engagementId, client), isNull(complianceInstances.filedOn), eq(complianceObligations.complianceArea, 'GST')))
      .limit(1);
    filing = instance!.id;
    saved = { windowFrom: instance!.windowFrom, windowTo: instance!.windowTo, status: instance!.status, filedOn: instance!.filedOn };

    const people = await db.select({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, internId: profiles.internId, clientId: profiles.clientId }).from(profiles);
    const of = (test: (p: (typeof people)[number]) => boolean) => people.find(test)!;
    manager = person(of((p) => p.id === row!.managerId), 'manager');
    lead = person(of((p) => p.internId === row!.internId), 'intern');
    foreignManager = person(of((p) => p.role === 'manager' && p.id !== row!.managerId && p.email?.includes('demo') === true), 'manager');
    const leads = await db.select({ internId: engagementLeads.internId }).from(engagementLeads).where(eq(engagementLeads.engagementId, client));
    foreignLead = person(of((p) => p.role === 'intern' && !leads.some((l) => l.internId === p.internId)), 'intern');
    admin = person(of((p) => p.role === 'admin'), 'admin');
    clientUser = person(of((p) => p.id === row!.clientUserId), 'client');
    developer = { ...manager, role: 'developer' };
    await cleanup();
    taskId = (await createTask(manager, { engagementId: client, activityId: null, name: 'zz-pack task', startDate: '2026-11-01', dueDate: '2026-12-01', urgency: 'Medium', visibility: 'firm', checklist: ['Line one'] })).id;
  });

  afterAll(cleanup);

  it('lets staff on the client read a filing, and reads as not there for anyone else', async () => {
    const detail = await read<{ title: string; beforeFiling: unknown[]; filledBySbc: unknown[] }>({ auth: manager }, 'compliance.getFiling', { itemId: filing });
    expect(detail.title).toBeTruthy();
    expect(detail.beforeFiling.length).toBeGreaterThan(0);
    expect(detail.filledBySbc.length).toBeGreaterThan(0);
    expect((await execute({ auth: lead }, 'compliance.getFiling', { itemId: filing })).ok).toBe(true);
    for (const auth of [foreignManager, foreignLead, developer]) {
      expect(await execute({ auth }, 'compliance.getFiling', { itemId: filing }), auth.email).toEqual({ ok: false, error: 'That item is not available.' });
    }
  });

  it('refuses a filing of another client even for an admin who can reach both', async () => {
    expect(await execute({ auth: admin, client: otherClient }, 'compliance.getFiling', { itemId: filing })).toEqual({ ok: false, error: 'That filing is not on this project.' });
    expect(await execute({ auth: admin, client: otherClient }, 'compliance.setStage', { itemId: filing, stage: 'waiting' })).toEqual({ ok: false, error: 'That filing is not on this project.' });
  });

  it('moves a stage for staff, keeps not-applicable for a manager, and undoes it', async () => {
    const moved = await approve({ auth: lead }, 'compliance.setStage', { itemId: filing, stage: 'waiting' });
    expect(moved).toMatchObject({ ok: true });
    expect((await read<{ stage: string }>({ auth: lead }, 'compliance.getFiling', { itemId: filing })).stage).toBe(STAGE_LABEL.waiting);
    expect((await undo({ auth: lead }, 'compliance.setStage', moved)).ok).toBe(true);
    expect((await read<{ stage: string }>({ auth: lead }, 'compliance.getFiling', { itemId: filing })).stage).not.toBe(STAGE_LABEL.waiting);
    expect(await execute({ auth: lead }, 'compliance.setStage', { itemId: filing, stage: 'not-applicable' })).toEqual({ ok: false, error: 'You cannot do this on this item.' });
    const draft = await (await action('compliance.setStage')).preview(context({ auth: lead }), { itemId: filing, stage: 'not-applicable' });
    expect(draft!.rows[0]!.target.needsManager).toBe(true);
    expect(await execute({ auth: clientUser }, 'compliance.setStage', { itemId: filing, stage: 'waiting' })).toEqual({ ok: false, error: 'You cannot do this on this item.' });
  });

  it('runs submit and review as the reviewer rule says, and never lets a lead approve', async () => {
    const reviewed = { itemId: filing, decision: 'approve' };
    await expect((await action('compliance.review')).preview(context({ auth: manager }), reviewed)).rejects.toThrow('not waiting for review');
    expect(await approve({ auth: lead }, 'compliance.submitForReview', { itemId: filing })).toMatchObject({ ok: true });
    await expect((await action('compliance.submitForReview')).preview(context({ auth: lead }), { itemId: filing })).rejects.toThrow('already');
    expect((await execute({ auth: lead }, 'compliance.submitForReview', { itemId: filing })).ok).toBe(false);
    await expect((await action('compliance.review')).preview(context({ auth: lead }), reviewed)).rejects.toThrow('You cannot review');
    expect(await execute({ auth: lead }, 'compliance.review', reviewed)).toEqual({ ok: false, error: 'You cannot do this on this item.' });
    expect(await approve({ auth: manager }, 'compliance.review', { itemId: filing, decision: 'send-back', note: 'Check the credit' })).toMatchObject({ ok: true });
    const back = await read<{ stage: string; reviewNote: string }>({ auth: lead }, 'compliance.getFiling', { itemId: filing });
    expect(back).toMatchObject({ stage: STAGE_LABEL.rework, reviewNote: 'Check the credit' });
    await approve({ auth: lead }, 'compliance.submitForReview', { itemId: filing });
    expect(await approve({ auth: manager }, 'compliance.review', reviewed)).toMatchObject({ ok: true });
    expect((await fetchInstance()).filedOn).toBeNull();
  });

  it('sets a working window for a manager and undoes it, and refuses a lead and an outsider', async () => {
    const input = { itemId: filing, from: '2026-12-01', to: '2026-12-05' };
    const set = await approve({ auth: manager }, 'compliance.setWorkingWindow', input);
    expect(set).toMatchObject({ ok: true });
    expect((await fetchInstance()).windowFrom).toBe('2026-12-01');
    expect(await execute({ auth: lead }, 'compliance.setWorkingWindow', input)).toEqual({ ok: false, error: 'Only a manager or admin can set a working window.' });
    expect((await execute({ auth: foreignManager }, 'compliance.setWorkingWindow', input)).ok).toBe(false);
    expect((await execute({ auth: manager }, 'compliance.setWorkingWindow', { ...input, from: '2026-12-09' })).ok).toBe(false);
    expect((await undo({ auth: manager }, 'compliance.setWorkingWindow', set)).ok).toBe(true);
    expect((await fetchInstance()).windowFrom).toBe(saved.windowFrom);
  });

  it('runs a date change from the lead\'s request to the manager\'s decision, and moves no due date', async () => {
    const due = (await fetchInstance()).dueDate;
    await approve({ auth: manager }, 'compliance.setWorkingWindow', { itemId: filing, from: '2026-12-01', to: '2026-12-05' });
    const ask = { itemId: filing, toDate: '2026-12-09', reason: 'Data came late' };
    expect((await execute({ auth: manager }, 'compliance.requestDateChange', ask)).ok).toBe(false);
    const first = await approve({ auth: lead }, 'compliance.requestDateChange', ask);
    expect(first).toMatchObject({ ok: true });
    expect(await execute({ auth: lead }, 'compliance.requestDateChange', ask)).toEqual({ ok: false, error: expect.stringContaining('already have a date change') });
    expect((await undo({ auth: lead }, 'compliance.requestDateChange', first)).ok).toBe(true);
    await approve({ auth: lead }, 'compliance.requestDateChange', ask);

    const { requests } = await read<{ requests: Array<{ id: string; status: string; toDate: string }> }>({ auth: manager }, 'compliance.listDateChanges', {});
    const requestId = requests.find((r) => r.toDate === ask.toDate)!.id;
    expect((await read<{ total: number }>({ auth: admin, client: otherClient }, 'compliance.listDateChanges', {})).total).toBe(0);
    expect((await execute({ auth: lead }, 'compliance.decideDateChange', { requestId, decision: 'approve' })).ok).toBe(false);
    expect((await execute({ auth: admin, client: otherClient }, 'compliance.decideDateChange', { requestId, decision: 'approve' })).ok).toBe(false);
    await expect((await action('compliance.decideDateChange')).preview(context({ auth: manager }), { requestId, decision: 'reject' })).rejects.toThrow('note');
    expect(await approve({ auth: manager }, 'compliance.decideDateChange', { requestId, decision: 'approve' })).toMatchObject({ ok: true });
    const after = await fetchInstance();
    expect(after.windowTo).toBe('2026-12-09');
    expect(after.dueDate).toBe(due);
    expect((await execute({ auth: manager }, 'compliance.decideDateChange', { requestId, decision: 'approve' })).ok).toBe(false);
    await db.update(complianceInstances).set({ windowFrom: saved.windowFrom, windowTo: saved.windowTo }).where(eq(complianceInstances.id, filing));
  });

  it('records a filing\'s details and undoes them, and sets the person\'s own reminder', async () => {
    const recorded = await approve({ auth: lead }, 'compliance.recordDetails', { itemId: filing, acknowledgementNo: 'AA360000000001', draftDueOn: '2026-12-03' });
    expect(recorded).toMatchObject({ ok: true });
    const [row] = await db.select().from(complianceInstanceDetails).where(eq(complianceInstanceDetails.instanceId, filing));
    expect(row).toMatchObject({ acknowledgementNo: 'AA360000000001', draftDueOn: '2026-12-03' });
    expect((await undo({ auth: lead }, 'compliance.recordDetails', recorded)).ok).toBe(true);
    const [back] = await db.select().from(complianceInstanceDetails).where(eq(complianceInstanceDetails.instanceId, filing));
    expect(back).toMatchObject({ acknowledgementNo: null, draftDueOn: null });
    expect(await execute({ auth: foreignLead }, 'compliance.recordDetails', { itemId: filing, draftDueOn: '2026-12-03' })).toEqual({ ok: false, error: 'That item is not available.' });

    const reminder = await execute({ auth: lead }, 'compliance.remindMe', { itemId: filing });
    expect(reminder).toMatchObject({ ok: true });
    expect(await db.select().from(complianceReminders).where(and(eq(complianceReminders.instanceId, filing), eq(complianceReminders.userId, lead.userId)))).toHaveLength(1);
    expect((await undo({ auth: lead }, 'compliance.remindMe', reminder)).ok).toBe(true);
    expect(await db.select().from(complianceReminders).where(eq(complianceReminders.instanceId, filing))).toHaveLength(0);
  });

  it('saves the fields and undoes them, ticks and unticks, and refuses what the record does not have', async () => {
    const start = await read<{ filledBySbc: Array<{ key: string }> }>({ auth: lead }, 'compliance.getFiling', { itemId: filing });
    const key = start.filledBySbc[start.filledBySbc.length - 1]!.key;
    const saving = { itemId: filing, fields: [{ key, value: '12500' }] };
    const fields = await approve({ auth: lead }, 'compliance.saveFields', saving);
    expect(fields).toMatchObject({ ok: true });
    const detail = await read<{ filledBySbc: Array<{ key: string; value: string | null }> }>({ auth: lead }, 'compliance.getFiling', { itemId: filing });
    expect(detail.filledBySbc.find((field) => field.key === key)?.value).toBe('12500');
    expect((await undo({ auth: lead }, 'compliance.saveFields', fields)).ok).toBe(true);
    expect((await execute({ auth: lead }, 'compliance.saveFields', { itemId: filing, fields: [{ key: 'nope', value: '1' }] })).ok).toBe(false);
    expect((await execute({ auth: foreignLead }, 'compliance.saveFields', saving)).ok).toBe(false);

    const { beforeFiling } = await read<{ beforeFiling: Array<{ line: string }> }>({ auth: lead }, 'compliance.getFiling', { itemId: filing });
    const tick = await approve({ auth: lead }, 'compliance.tickChecklist', { itemId: filing, lines: [beforeFiling[0]!.line], checked: true });
    expect(tick).toMatchObject({ ok: true });
    expect(await db.select().from(complianceChecklistChecks).where(eq(complianceChecklistChecks.subjectKey, filing))).toHaveLength(1);
    expect((await undo({ auth: lead }, 'compliance.tickChecklist', tick)).ok).toBe(true);
    expect(await db.select().from(complianceChecklistChecks).where(eq(complianceChecklistChecks.subjectKey, filing))).toHaveLength(0);
  });

  it('asks the client for a document, and reviews only an upload that is waiting', async () => {
    expect(await approve({ auth: lead }, 'compliance.askDocument', { itemId: filing, label: 'zz-pack bank statement' })).toMatchObject({ ok: true });
    const { documents } = await read<{ documents: Array<{ requestId: string; label: string; status: string }> }>({ auth: lead }, 'compliance.getFiling', { itemId: filing });
    const asked = documents.find((doc) => doc.label === 'zz-pack bank statement')!;
    expect(asked.status).toBe('Asked');
    expect(await execute({ auth: lead }, 'compliance.reviewDocument', { itemId: filing, requestId: asked.requestId, decision: 'accept' })).toEqual({ ok: false, error: 'That document is not waiting for review.' });
    await db.update(documentRequests).set({ status: 'fulfilled' }).where(eq(documentRequests.id, asked.requestId));
    expect(await approve({ auth: lead }, 'compliance.reviewDocument', { itemId: filing, requestId: asked.requestId, decision: 'accept' })).toMatchObject({ ok: true });
    expect((await db.select().from(documentRequests).where(eq(documentRequests.id, asked.requestId)))[0]!.status).toBe('approved');
    expect(await execute({ auth: clientUser }, 'compliance.askDocument', { itemId: filing, label: 'zz-pack bank statement' })).toEqual({ ok: false, error: 'Only firm staff ask for documents' });
  });

  it('keeps reminders lead and reopening for a manager, and locks a filed period', async () => {
    const days = { itemKind: 'filing', itemId: filing, notifyDays: 11 };
    expect(await execute({ auth: lead }, 'compliance.setReminderLead', days)).toEqual({ ok: false, error: 'You cannot do this on this item.' });
    const changed = await approve({ auth: manager }, 'compliance.setReminderLead', days);
    expect(changed).toMatchObject({ ok: true });
    expect((await undo({ auth: manager }, 'compliance.setReminderLead', changed)).ok).toBe(true);
    expect((await approve({ auth: manager }, 'compliance.setReminderLead', { itemKind: 'task', itemId: taskId, notifyDays: 9 })).ok).toBe(true);
    expect((await execute({ auth: admin, client: otherClient }, 'compliance.setReminderLead', { itemKind: 'task', itemId: taskId, notifyDays: 9 })).ok).toBe(false);

    await expect((await action('compliance.reopenFiling')).preview(context({ auth: manager }), { itemId: filing })).rejects.toThrow('not filed');
    await db.update(complianceInstances).set({ status: 'filed', filedOn: '2026-11-01' }).where(eq(complianceInstances.id, filing));
    await expect((await action('compliance.saveFields')).preview(context({ auth: lead }), { itemId: filing, fields: [{ key: 'gstin', value: '1' }] })).rejects.toThrow('locked after filing');
    expect((await execute({ auth: manager }, 'compliance.setWorkingWindow', { itemId: filing, from: '2026-12-01', to: '2026-12-05' })).ok).toBe(false);
    expect(await execute({ auth: lead }, 'compliance.setStage', { itemId: filing, stage: 'waiting' })).toEqual({ ok: false, error: 'This filing is already filed.' });
    expect(await execute({ auth: lead }, 'compliance.reopenFiling', { itemId: filing })).toEqual({ ok: false, error: 'Only a manager or admin can reopen a filing' });
    const reopened = await approve({ auth: manager }, 'compliance.reopenFiling', { itemId: filing });
    expect(reopened).toMatchObject({ ok: true });
    expect((await fetchInstance()).filedOn).toBeNull();
    expect((await undo({ auth: manager }, 'compliance.reopenFiling', reopened)).ok).toBe(true);
    expect((await fetchInstance()).filedOn).toBe('2026-11-01');
    await db.update(complianceInstances).set(saved).where(eq(complianceInstances.id, filing));
  });

  it('ticks a task line by its words and undoes it, and keeps removing a line for a manager', async () => {
    const ticked = await approve({ auth: manager }, 'compliance.tickTaskLine', { taskId, label: 'line one', done: true });
    expect(ticked).toMatchObject({ ok: true });
    expect((await undo({ auth: manager }, 'compliance.tickTaskLine', ticked)).ok).toBe(true);
    expect((await execute({ auth: foreignManager }, 'compliance.tickTaskLine', { taskId, label: 'Line one', done: true })).ok).toBe(false);
    expect((await execute({ auth: admin, client: otherClient }, 'compliance.tickTaskLine', { taskId, label: 'Line one', done: true })).ok).toBe(false);
    expect((await execute({ auth: lead }, 'compliance.removeTaskLine', { taskId, label: 'Line one' })).ok).toBe(false);
    expect(await approve({ auth: manager }, 'compliance.removeTaskLine', { taskId, label: 'Line one' })).toMatchObject({ ok: true });
  });

  it('reads the registrations and their reasons, and keeps them to staff on the client', async () => {
    const { registrations } = await read<{ registrations: Array<{ id: string; status: string; category: string }> }>({ auth: lead }, 'registrations.list', {});
    expect(registrations.length).toBeGreaterThan(0);
    expect(registrations.every((r) => r.status && r.category)).toBe(true);
    const detail = await read<{ id: string; beforeFiling: unknown[]; filledBySbc: unknown[] }>({ auth: manager }, 'registrations.get', { itemId: 'reg-4' });
    expect(detail.id).toBe('reg-4');
    expect(detail.beforeFiling.length).toBeGreaterThan(0);
    expect(detail.filledBySbc.length).toBeGreaterThan(0);
    for (const auth of [foreignManager, foreignLead]) expect((await execute({ auth }, 'registrations.list', {})).ok, auth.email).toBe(false);
  });

  it('sets a registration\'s dates, keeps what it leaves out, and puts them back', async () => {
    const before = (await read<{ issuedOn: string | null; expiresOn: string | null }>({ auth: manager }, 'registrations.get', { itemId: 'reg-4' }));
    const set = await approve({ auth: lead }, 'registrations.setDates', { itemId: 'reg-4', issuedOn: '2026-02-01', expiresOn: '2027-02-01', renewEveryMonths: 12 });
    expect(set).toMatchObject({ ok: true });
    const kept = await approve({ auth: lead }, 'registrations.setDates', { itemId: 'reg-4', expiresOn: '2028-02-01' });
    expect(kept).toMatchObject({ ok: true });
    expect(await read({ auth: lead }, 'registrations.get', { itemId: 'reg-4' })).toMatchObject({ issuedOn: '2026-02-01', expiresOn: '2028-02-01', renewEveryMonths: 12 });
    expect(await execute({ auth: lead }, 'registrations.setDates', { itemId: 'reg-4', expiresOn: '2020-01-01' })).toEqual({ ok: false, error: 'The expiry date is before the issue date.' });
    expect((await execute({ auth: foreignLead }, 'registrations.setDates', { itemId: 'reg-4', expiresOn: '2028-02-01' })).ok).toBe(false);
    expect((await undo({ auth: lead }, 'registrations.setDates', kept)).ok).toBe(true);
    expect((await undo({ auth: lead }, 'registrations.setDates', set)).ok).toBe(true);
    expect(await read({ auth: lead }, 'registrations.get', { itemId: 'reg-4' })).toMatchObject({ issuedOn: before.issuedOn, expiresOn: before.expiresOn });
  });

  it('saves a registration\'s fields and ticks its checklist', async () => {
    const fields = await approve({ auth: lead }, 'registrations.saveFields', { itemId: 'reg-4', fields: [{ key: 'arn', value: 'AA3611110000001' }] });
    expect(fields).toMatchObject({ ok: true });
    expect((await read<{ filledBySbc: Array<{ key: string; value: string | null }> }>({ auth: lead }, 'registrations.get', { itemId: 'reg-4' })).filledBySbc.find((f) => f.key === 'arn')?.value).toBe('AA3611110000001');
    expect((await undo({ auth: lead }, 'registrations.saveFields', fields)).ok).toBe(true);
    const tick = await approve({ auth: lead }, 'registrations.tickChecklist', { itemId: 'reg-4', lines: ['documents'], checked: true });
    expect(tick).toMatchObject({ ok: true });
    expect((await undo({ auth: lead }, 'registrations.tickChecklist', tick)).ok).toBe(true);
    await db.delete(complianceSubjectFields).where(and(eq(complianceSubjectFields.engagementId, client), eq(complianceSubjectFields.subjectKey, 'reg-4')));
  });
});
