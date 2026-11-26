import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { cancelOtpRequestsFor, createOtpRequest, listOtpRequestsFor } from '@/db/repositories/agent-otp';
import { GstAgentError, isGstAgentStaff } from '@/db/repositories/gst-agent-scope';
import { getGstProfile } from '@/db/repositories/gst-profile';
import {
  createGstReturnRun,
  getGstReturnRun,
  splitSummary,
  systemFilingInstanceId,
  systemGetRun,
  systemRunContext,
  systemUpdateRun,
  toRunView,
  updateGstReturnRun,
} from '@/db/repositories/gst-returns';
import { getEngagementGstnSession } from '@/db/repositories/gstn-sessions';
import { markFilingFiled, FilingStatusError } from '@/db/repositories/filing-status';
import { upsertFilingDetails } from '@/db/repositories/client-compliances';
import { GstzenError, gstzen } from './client';
import { gstzenGate } from './gate';
import { ackNumberOf, dataJsonStringOf, gstr3bSummary, gstr9FilePayload, gstr9cFilePayload, retsumData } from './mappers';
import { checksComplete, nextStatus, type GstCheckKey } from './run-state';
import { queueReturnWork, type WorkTask } from './work';
import { GST_FORM_LABEL, PAN_RE, type AgentOtpRequestView, type GstForm, type GstReturnRunView, type GstnSessionView } from './types';

/**
 * GST RETURN RUNS — what the card's buttons do (MASTER-PLAN screen 7). Each action checks the route
 * (`gstzenGate`), the scope (the repositories) and the state machine (`run-state.ts`), starts any
 * slow GSP work as a job (`work.ts`) and writes an audit event. The EVC filing (`fileReturnWithEvc`)
 * runs inside the OTP answer request, because the OTP must go straight to GSTZen and never into a
 * job queue (decision B7).
 */

export interface RunBundle {
  run: GstReturnRunView;
  session: GstnSessionView | null;
  otp: AgentOtpRequestView[];
}

async function gateOrThrow(userId: string): Promise<void> {
  const g = await gstzenGate(userId);
  if (g.open === false) throw new GstAgentError(g.message, 503);
}

export async function getRunBundle(ctx: AuthContext, runId: string, now = new Date()): Promise<RunBundle> {
  const row = await getGstReturnRun(ctx, runId);
  const [view, s, otp] = await Promise.all([
    toRunView(row),
    getEngagementGstnSession(ctx, row.engagementId, now),
    listOtpRequestsFor(ctx, { engagementId: row.engagementId, subjectType: 'gst_return_run', subjectId: row.id }, now),
  ]);
  return { run: view, session: s.session && s.gstin === row.gstin ? s.session : null, otp };
}

function sessionActive(s: GstnSessionView | null): boolean {
  return s?.status === 'active';
}

async function audit(ctx: AuthContext, engagementId: string, action: string, summary: string, metadata: Record<string, unknown>) {
  await recordAuditEvent(ctx, { engagementId, action, summary, metadata });
}

/** Opens (or reopens) the run for a form and period and starts it: consent first when no session is active. */
export async function startReturnRun(ctx: AuthContext, input: { engagementId: string; form: GstForm; period: string }): Promise<RunBundle> {
  if (!isGstAgentStaff(ctx)) throw new GstAgentError('Only firm staff can start a GST return.', 403);
  await gateOrThrow(ctx.userId);
  const { row, created } = await createGstReturnRun(ctx, input);
  if (row.status === 'draft') {
    const s = await getEngagementGstnSession(ctx, row.engagementId);
    const to = nextStatus('draft', { type: 'start', sessionActive: sessionActive(s.session) })!;
    await updateGstReturnRun(ctx, row.id, { status: to, error: null, flow: to === 'saving' ? { working: 'save' } : {} });
    if (to === 'saving') await queueReturnWork(row.id, 'save');
  }
  if (created) await audit(ctx, row.engagementId, 'gstzen.return.started', `${GST_FORM_LABEL[input.form]} ${input.period} started through GSTZen`, { runId: row.id, form: input.form, period: input.period, gstin: row.gstin });
  return getRunBundle(ctx, row.id);
}

export type RunAction =
  | { action: 'save' }
  | { action: 'retry' }
  | { action: 'check'; which: GstCheckKey; checked: boolean }
  | { action: 'offset' }
  | { action: 'proceed' }
  | { action: 'refresh_balance' }
  | { action: 'evc'; audience: 'staff' | 'client'; signatoryPan?: string | null }
  | { action: 'cancel' };

/** One button on the card. Answers the run as it is now. */
export async function runReturnAction(ctx: AuthContext, runId: string, a: RunAction): Promise<RunBundle> {
  if (!isGstAgentStaff(ctx)) throw new GstAgentError('Only firm staff can work a GST return.', 403);
  const row = await getGstReturnRun(ctx, runId);
  const form = row.form as GstForm;
  const { summary, flow } = splitSummary(row.summary);
  const status = row.status as GstReturnRunView['status'];
  const label = `${GST_FORM_LABEL[form]} ${row.period}`;

  if (a.action === 'cancel') {
    const to = nextStatus(status, { type: 'cancel' });
    if (!to) throw new GstAgentError('This return cannot be cancelled now.', 409);
    await updateGstReturnRun(ctx, runId, { status: to, flow: { working: null } });
    await cancelOtpRequestsFor(ctx, { engagementId: row.engagementId, subjectType: 'gst_return_run', subjectId: runId });
    await audit(ctx, row.engagementId, 'gstzen.return.cancelled', `${label} cancelled`, { runId });
    return getRunBundle(ctx, runId);
  }

  if (a.action === 'check') {
    if (status !== 'saved' && status !== 'checked') throw new GstAgentError('The checks open once the portal’s figures are saved.', 409);
    const checks = { ...(row.checks ?? {}) };
    if (a.checked) checks[a.which] = { by: ctx.userId, at: new Date().toISOString() };
    else delete checks[a.which];
    const complete = checksComplete(checks);
    const to = complete ? nextStatus(status, { type: 'check_complete' }) : nextStatus(status, { type: 'check_incomplete' });
    await updateGstReturnRun(ctx, runId, { checks, ...(to ? { status: to } : {}) });
    await audit(ctx, row.engagementId, a.checked ? 'gstzen.return.checked' : 'gstzen.return.unchecked', `${label}: certifier ${a.checked ? 'ticked' : 'cleared'} the ${a.which === 'figures' ? 'figures' : 'second'} check`, { runId, which: a.which });
    return getRunBundle(ctx, runId);
  }

  // Everything below calls GSTZen.
  await gateOrThrow(ctx.userId);
  const s = await getEngagementGstnSession(ctx, row.engagementId);
  const live = sessionActive(s.session && s.gstin === row.gstin ? s.session : null);

  const queue = async (task: WorkTask, to: GstReturnRunView['status'] | null) => {
    if (!live) throw new GstAgentError('The GSTN session is not active. Ask for the consent OTP first.', 409);
    await updateGstReturnRun(ctx, runId, { ...(to && to !== status ? { status: to } : {}), error: null, flow: { working: task } });
    await queueReturnWork(runId, task);
    await audit(ctx, row.engagementId, `gstzen.return.${task}_started`, `${label}: ${task} started`, { runId });
  };

  switch (a.action) {
    case 'save': {
      if (!live) {
        // No session: the run waits for consent; the save starts when the OTP is answered.
        if (status !== 'consent_needed' && nextStatus(status, { type: 'save' })) await updateGstReturnRun(ctx, runId, { status: 'consent_needed' });
        return getRunBundle(ctx, runId);
      }
      const to = nextStatus(status, { type: 'save' });
      if (!to) throw new GstAgentError('The return cannot be saved again now.', 409);
      await queue('save', to);
      break;
    }
    case 'retry': {
      const to = nextStatus(status, { type: 'retry', at: flow.failedAt ?? null });
      if (!to) throw new GstAgentError('Nothing to retry.', 409);
      if (to === 'saving') await queue('save', to);
      else await updateGstReturnRun(ctx, runId, { status: to, error: null, flow: { failedAt: null } });
      break;
    }
    case 'offset': {
      if (form !== 'gstr3b') throw new GstAgentError('Only GSTR-3B has an offset.', 400);
      if (flow.offsetDone) throw new GstAgentError('The liability is already set off.', 409);
      const to = status === 'checked' ? nextStatus(status, { type: 'file_start' }) : status === 'filing' ? 'filing' : null;
      if (!to) throw new GstAgentError('Tick both checks before the offset.', 409);
      await queue('offset', to);
      break;
    }
    case 'proceed': {
      if (form === 'gstr3b') throw new GstAgentError('GSTR-3B has no proceed to file step.', 400);
      if (flow.proceedDone) throw new GstAgentError('The return is already frozen for filing.', 409);
      const to = status === 'checked' ? nextStatus(status, { type: 'file_start' }) : status === 'filing' ? 'filing' : null;
      if (!to) throw new GstAgentError('Tick both checks before proceeding to file.', 409);
      await queue('proceed', to);
      break;
    }
    case 'refresh_balance': {
      if (form !== 'gstr3b' || !summary) throw new GstAgentError('Only a saved GSTR-3B has a cash balance.', 400);
      if (!live) throw new GstAgentError('The GSTN session is not active. Ask for the consent OTP first.', 409);
      const api = gstzen();
      const [retsum, balance] = await Promise.all([api.gstr3bSummary(row.gstin, row.period), api.gstr3bCashItcBalance(row.gstin, row.period)]).catch((e) => {
        throw e instanceof GstzenError ? new GstAgentError(e.message, 422) : e;
      });
      const fresh = gstr3bSummary({ retsum, cashBalance: balance, now: new Date() }).summary;
      await updateGstReturnRun(ctx, runId, { summary: { ...fresh, twoB: summary.twoB ?? null } });
      await audit(ctx, row.engagementId, 'gstzen.return.balance_read', `${label}: cash ledger balance read`, { runId, cashShort: fresh.cashShort ?? null });
      break;
    }
    case 'evc': {
      if (status !== 'filing' || !(form === 'gstr3b' ? flow.offsetDone : flow.proceedDone)) throw new GstAgentError(form === 'gstr3b' ? 'Set off the liability before the EVC.' : 'Proceed to file before the EVC.', 409);
      if (!live) throw new GstAgentError('The GSTN session is not active. Ask for the consent OTP first.', 409);
      const pan = (a.signatoryPan?.trim().toUpperCase() || flow.signatoryPan || (await signatoryPanOf(ctx, row.engagementId)) || '').toUpperCase();
      if (!PAN_RE.test(pan)) throw new GstAgentError('Type the authorised signatory’s PAN: it is not on the GST registration.', 422);
      try {
        await gstzen().generateEvcOtp(form, row.gstin, row.period, pan);
      } catch (e) {
        throw e instanceof GstzenError ? new GstAgentError(e.message, 422) : e;
      }
      await updateGstReturnRun(ctx, runId, { flow: { signatoryPan: pan } });
      await createOtpRequest(ctx, {
        engagementId: row.engagementId,
        purpose: 'evc',
        subjectType: 'gst_return_run',
        subjectId: runId,
        gstin: row.gstin,
        sentTo: 'the authorised signatory’s registered mobile and email',
        audience: a.audience,
      });
      await audit(ctx, row.engagementId, 'gstzen.evc.requested', `${label}: EVC OTP requested`, { runId, audience: a.audience });
      break;
    }
  }
  return getRunBundle(ctx, runId);
}

/** The authorised signatory's PAN from the GST registration profile, when staff can read it. */
async function signatoryPanOf(ctx: AuthContext, engagementId: string): Promise<string | null> {
  try {
    const p = await getGstProfile(ctx, engagementId);
    return p.ok ? (p.result.profile.signatory?.pan?.trim().toUpperCase() ?? null) : null;
  } catch {
    return null;
  }
}

function todayIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/**
 * Files a run with the EVC OTP the person just typed. The OTP goes to GSTZen in this call and is not
 * kept anywhere. On success the ARN and the filed date go on the run and on the compliance filing
 * (the same write as "Mark filed" plus the ARN on the filing's details). Staff answer as themselves;
 * a client's answer writes the filing as the staff member who started the run.
 */
export async function fileReturnWithEvc(ctx: AuthContext, runId: string, otp: string): Promise<{ arn: string }> {
  const row = await systemGetRun(runId);
  if (!row) throw new GstAgentError('Return run not found.', 404);
  if (row.status !== 'filing') throw new GstAgentError('This return is not waiting for its EVC.', 409);
  const form = row.form as GstForm;
  const { flow } = splitSummary(row.summary);
  const pan = flow.signatoryPan;
  if (!pan) throw new GstAgentError('Ask for the EVC OTP again.', 409);

  const api = gstzen();
  let arn: string | null;
  try {
    if (form === 'gstr1') {
      const retsum = await api.gstr1Download(row.gstin, row.period, 'retsum');
      const dataJsonString = dataJsonStringOf(retsum);
      if (!dataJsonString) throw new GstAgentError('The portal has not prepared the GSTR-1 summary for filing yet.', 409);
      arn = ackNumberOf(await api.fileWithEvc(form, row.gstin, row.period, { otp, signatoryPan: pan, dataJsonString }));
    } else if (form === 'gstr3b') {
      const retsum = await api.gstr3bSummary(row.gstin, row.period);
      arn = ackNumberOf(await api.fileWithEvc(form, row.gstin, row.period, { otp, signatoryPan: pan, jsonData: retsumData(retsum) }));
    } else if (form === 'gstr9') {
      const records = await api.gstr9Records(row.gstin, row.period);
      arn = ackNumberOf(await api.fileWithEvc(form, row.gstin, row.period, { otp, signatoryPan: pan, jsonData: gstr9FilePayload(records) }));
    } else {
      const retsum = await api.gstr9cSummary(row.gstin, row.period);
      arn = ackNumberOf(await api.fileWithEvc(form, row.gstin, row.period, { otp, signatoryPan: pan, jsonData: gstr9cFilePayload(retsum) }));
    }
  } catch (e) {
    if (e instanceof GstzenError) throw new GstAgentError(e.message, 422);
    throw e;
  }
  if (!arn) throw new GstAgentError('The portal did not return an ARN. Check the return on the portal before trying again.', 422);

  const now = new Date();
  await systemUpdateRun(runId, { status: 'filed', arn, filedAt: now, error: null, flow: { working: null } });

  const staffCtx = isGstAgentStaff(ctx) ? ctx : await systemRunContext(runId);
  const label = `${GST_FORM_LABEL[form]} ${row.period}`;
  const instanceId = await systemFilingInstanceId(row);
  if (staffCtx && instanceId) {
    try {
      await markFilingFiled(staffCtx, instanceId, { filedOn: todayIst(now), note: `Filed through GSTZen with EVC. ARN ${arn}.` });
    } catch (e) {
      if (!(e instanceof FilingStatusError && e.status === 409)) throw e;
    }
    await upsertFilingDetails(staffCtx, instanceId, { acknowledgementNo: arn, filedBy: staffCtx.userId }).catch(() => undefined);
  }
  await recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: 'gstzen.return.filed',
    summary: `${label} filed with EVC. ARN ${arn}`,
    metadata: { runId, form, period: row.period, gstin: row.gstin, arn, instanceId, answeredBy: ctx.role === 'client' ? 'client' : 'staff' },
  });
  return { arn };
}
