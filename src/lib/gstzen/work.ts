import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { splitSummary, systemGetRun, systemRunContext, systemUpdateRun } from '@/db/repositories/gst-returns';
import { systemMarkSessionInactive } from '@/db/repositories/gstn-sessions';
import { GstzenError, gstzen, type GstzenClient } from './client';
import { gstzenGate } from './gate';
import {
  dataJsonStringOf,
  gstr1Summary,
  gstr3bLiability,
  gstr3bSaveFromAutoLiab,
  gstr3bSummary,
  gstr9Data,
  gstr9Summary,
  gstr9cSummary,
  invoiceCountOf,
  offsetPayload,
  referenceIdOf,
  retStatusOf,
  TRANS_FORWARD,
} from './mappers';
import { GST_FORM_LABEL, type GstForm, type GstReturnSummary, type GstRunStatus } from './types';

/**
 * GST RETURN WORK — the slow GSP calls of a return run, run by the Inngest job
 * `src/jobs/gst-return-work.ts` (or in this process when Inngest cannot be reached):
 *
 *   save    — GSTR-3B: auto-calculated liability → save → status → summary, cash and 2B.
 *             GSTR-1: the portal's summary and e-invoice count (Suite uploads nothing).
 *             GSTR-9: auto-calculated figures → save → status → saved figures.
 *             GSTR-9C: the GSTR-9 figures and the saved 9C (Suite cannot build the audited data).
 *   offset  — GSTR-3B only: ITC and cash against the liability, after the person paid any cash due.
 *   proceed — GSTR-1, GSTR-9, GSTR-9C: proceed to file → status → the summary to sign.
 *
 * Each task is three calls the job wraps in steps: `beginWork`, `pollWork` (repeated with growing
 * waits, as GSTZen advises: 5 s, 10 s, 1 min, 10 min …) and `finishWork`. Errors land on the run as
 * one plain sentence. The job acts, and is audited, as the person who started the run. No OTP, token
 * or figure is logged.
 */

export const GST_RETURN_WORK_EVENT = 'gstzen/return.work';
export type WorkTask = 'save' | 'offset' | 'proceed';

/** Waits between status checks, in seconds (about 19 minutes in all). */
export const POLL_DELAYS_S = [5, 10, 30, 60, 120, 300, 600] as const;

export type BeginResult = { next: 'poll'; referenceId: string } | { next: 'finish' } | { next: 'stop'; reason: string };

const STATUS_FOR: Record<WorkTask, GstRunStatus> = { save: 'saving', offset: 'filing', proceed: 'filing' };

/** The portal's way of saying the GSTN session is gone. */
export function isSessionError(message: string): boolean {
  return /session/i.test(message) && /(not established|expired|inactive|invalid|not active)/i.test(message);
}

interface Loaded {
  run: NonNullable<Awaited<ReturnType<typeof systemGetRun>>>;
  ctx: AuthContext;
  form: GstForm;
  api: GstzenClient;
}

async function load(runId: string, task: WorkTask): Promise<Loaded | { stop: string }> {
  const run = await systemGetRun(runId);
  if (!run) return { stop: 'run_not_found' };
  if (run.status !== STATUS_FOR[task]) return { stop: `status_${run.status}` };
  const ctx = await systemRunContext(runId);
  if (!ctx) {
    await fail(runId, task, 'The person who started this return no longer has access. Start it again.');
    return { stop: 'no_actor' };
  }
  const gate = await gstzenGate(ctx.userId);
  if (gate.open === false) {
    await fail(runId, task, gate.message);
    return { stop: 'gate_closed' };
  }
  return { run, ctx, form: run.form as GstForm, api: gstzen() };
}

/** Puts a plain error on the run and stops the work. A lapsed session sends a save back to consent. */
export async function fail(runId: string, task: WorkTask, message: string): Promise<void> {
  const run = await systemGetRun(runId);
  if (!run || (run.status !== 'saving' && run.status !== 'filing')) return;
  const session = isSessionError(message);
  if (session) await systemMarkSessionInactive(run.gstin).catch(() => undefined);
  const toConsent = session && run.status === 'saving';
  await systemUpdateRun(runId, {
    status: toConsent ? 'consent_needed' : 'failed',
    error: toConsent ? 'The GSTN session has lapsed. Ask for a new consent OTP.' : message,
    flow: { working: null, failedAt: toConsent ? null : task === 'save' ? 'save' : 'file' },
  }).catch(() => undefined);
  const ctx = await systemRunContext(runId);
  if (ctx) {
    await recordAuditEvent(ctx, {
      engagementId: run.engagementId,
      action: `gstzen.return.${task}_failed`,
      summary: `${GST_FORM_LABEL[run.form as GstForm] ?? run.form} ${run.period}: ${task} failed`,
      metadata: { runId, form: run.form, period: run.period, task, error: message },
      result: 'failed',
    });
  }
}

function errorText(err: unknown): string {
  if (err instanceof GstzenError) return err.message;
  return 'The GST return step failed. Try again in a few minutes.';
}

/** Runs a step body, turning any error into a failed run. Answers null after a failure. */
async function guarded<T>(runId: string, task: WorkTask, body: () => Promise<T>): Promise<T | null> {
  try {
    return await body();
  } catch (err) {
    await fail(runId, task, errorText(err));
    return null;
  }
}

/** Optional reads (cash balance, 2B, e-invoice count) never stop a save. */
async function optional<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

export async function beginWork(runId: string, task: WorkTask): Promise<BeginResult> {
  const l = await load(runId, task);
  if ('stop' in l) return { next: 'stop', reason: l.stop };
  const { run, form, api } = l;
  const out = await guarded<BeginResult>(runId, task, async () => {
    if (task === 'save') {
      if (form === 'gstr3b') {
        const auto = await api.gstr3bAutoLiability(run.gstin, run.period);
        const saved = await api.gstr3bSave(run.gstin, run.period, gstr3bSaveFromAutoLiab(auto));
        return pollOn(runId, referenceIdOf(saved));
      }
      if (form === 'gstr9') {
        const calc = await api.gstr9AutoCalculated(run.gstin, run.period);
        const saved = await api.gstr9Save(run.gstin, run.period, gstr9Data(calc));
        return pollOn(runId, referenceIdOf(saved));
      }
      return { next: 'finish' };
    }
    if (task === 'offset') {
      if (form !== 'gstr3b') return { next: 'stop', reason: 'not_gstr3b' };
      const now = new Date();
      const retsum = await api.gstr3bSummary(run.gstin, run.period);
      const balance = await api.gstr3bCashItcBalance(run.gstin, run.period);
      const { summary, plan } = gstr3bSummary({ retsum, cashBalance: balance, now });
      if ((summary.cashShort ?? 0) > 0) {
        // The ledger does not cover the cash yet: back to the person's pay step with fresh figures.
        const prev = splitSummary(run.summary).summary;
        await systemUpdateRun(runId, { status: 'checked', summary: { ...summary, twoB: prev?.twoB ?? null }, flow: { working: null }, error: null });
        return { next: 'stop', reason: 'cash_short' };
      }
      const fwd = gstr3bLiability(retsum).lines.find((x) => x.transTyp === TRANS_FORWARD);
      await api.gstr3bOffset(run.gstin, run.period, offsetPayload(plan, fwd?.liabLdgId ?? null));
      return { next: 'finish' };
    }
    // proceed
    if (form === 'gstr1') return pollOn(runId, referenceIdOf(await api.gstr1ProceedToFile(run.gstin, run.period)));
    if (form === 'gstr9') return pollOn(runId, referenceIdOf(await api.gstr9ProceedToFile(run.gstin, run.period)));
    if (form === 'gstr9c') {
      await api.gstr9cProceedToFile(run.gstin, run.period);
      return { next: 'finish' };
    }
    return { next: 'stop', reason: 'not_applicable' };
  });
  return out ?? { next: 'stop', reason: 'failed' };
}

async function pollOn(runId: string, referenceId: string | null): Promise<BeginResult> {
  if (!referenceId) return { next: 'finish' };
  await systemUpdateRun(runId, { referenceId });
  return { next: 'poll', referenceId };
}

/** One status check of the save or proceed reference. */
export async function pollWork(runId: string, task: WorkTask, referenceId: string): Promise<'pending' | 'done' | 'stop'> {
  const l = await load(runId, task);
  if ('stop' in l) return 'stop';
  const { run, form, api } = l;
  const out = await guarded(runId, task, async () => {
    const st = retStatusOf(await api.returnStatus(form, run.gstin, run.period, referenceId));
    if (st.state === 'error') throw new GstzenError('portal', st.error);
    return st.state === 'done' ? ('done' as const) : ('pending' as const);
  });
  return out ?? 'stop';
}

/** The figures after the work, written on the run with the next status. */
export async function finishWork(runId: string, task: WorkTask): Promise<'done' | 'stop'> {
  const l = await load(runId, task);
  if ('stop' in l) return 'stop';
  const { run, form, api, ctx } = l;
  const out = await guarded(runId, task, async () => {
    const now = new Date();
    const prev = splitSummary(run.summary).summary;
    let summary: GstReturnSummary;
    if (form === 'gstr3b') {
      const retsum = await api.gstr3bSummary(run.gstin, run.period);
      const cashBalance = await optional(() => api.gstr3bCashItcBalance(run.gstin, run.period));
      const twoB = task === 'save' ? await optional(() => api.gstr2b(run.gstin, run.period)) : undefined;
      summary = gstr3bSummary({ retsum, cashBalance, twoB, now }).summary;
      if (task !== 'save') summary = { ...summary, twoB: prev?.twoB ?? null };
    } else if (form === 'gstr1') {
      const retsum = await api.gstr1Download(run.gstin, run.period, 'retsum');
      if (task === 'proceed' && !dataJsonStringOf(retsum)) throw new GstzenError('portal', 'The portal has not prepared the GSTR-1 summary for filing yet. Try proceed to file again in a few minutes.');
      const einv = task === 'save' ? await optional(async () => invoiceCountOf(await api.gstr1Download(run.gstin, run.period, 'b2b-einv'), 'b2b')) : undefined;
      summary = gstr1Summary({ retsum, einvoices: einv ?? prev?.lines.find((x) => x.label === 'E-invoices on the portal')?.value ?? null, now });
    } else if (form === 'gstr9') {
      summary = gstr9Summary({ data: await api.gstr9Records(run.gstin, run.period), now });
    } else {
      const [records, retsum] = [await api.gstr9cRecords(run.gstin, run.period), await api.gstr9cSummary(run.gstin, run.period)];
      summary = gstr9cSummary({ records, retsum, now });
    }

    if (task === 'save') {
      // New figures: the certifier ticks again.
      await systemUpdateRun(runId, { status: 'saved', summary, checks: {}, error: null, flow: { working: null, failedAt: null, offsetDone: false, proceedDone: false } });
    } else {
      await systemUpdateRun(runId, { summary, error: null, flow: { working: null, failedAt: null, ...(task === 'offset' ? { offsetDone: true } : { proceedDone: true }) } });
    }
    await recordAuditEvent(ctx, {
      engagementId: run.engagementId,
      action: `gstzen.return.${task === 'save' ? 'saved' : task === 'offset' ? 'offset' : 'proceeded'}`,
      summary: `${GST_FORM_LABEL[form]} ${run.period}: ${task === 'save' ? 'saved on the portal and figures read' : task === 'offset' ? 'liability set off' : 'proceeded to file'}`,
      metadata: { runId, form, period: run.period, gstin: run.gstin, by: 'gstzen-job' },
    });
    return 'done' as const;
  });
  return out ?? 'stop';
}

/** Runs one task start to end in this process (no Inngest): waits with timers between checks. */
export async function runWorkInline(runId: string, task: WorkTask, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  try {
    const begun = await beginWork(runId, task);
    if (begun.next === 'stop') return;
    if (begun.next === 'poll') {
      let done = false;
      for (const s of POLL_DELAYS_S) {
        await sleep(s * 1000);
        const st = await pollWork(runId, task, begun.referenceId);
        if (st === 'stop') return;
        if (st === 'done') {
          done = true;
          break;
        }
      }
      if (!done) {
        await fail(runId, task, 'The portal is still processing the return. Try again later.');
        return;
      }
    }
    await finishWork(runId, task);
  } catch (err) {
    await fail(runId, task, errorText(err));
  }
}

/** Queues a task on Inngest; with no Inngest reachable it runs in this process. */
export async function queueReturnWork(runId: string, task: WorkTask): Promise<'queued' | 'inline'> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: GST_RETURN_WORK_EVENT, data: { runId, task } });
    return 'queued';
  } catch {
    void runWorkInline(runId, task);
    return 'inline';
  }
}
