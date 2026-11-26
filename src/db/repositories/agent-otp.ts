import 'server-only';

import { and, desc, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { agentOtpRequests, engagements, gstReturnRuns } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { listScopedEngagementIds } from '@/db/repositories/engagements';
import { GstAgentError, anyEngagement, isGstAgentStaff, staffEngagement } from '@/db/repositories/gst-agent-scope';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { GST_FORM_LABEL, OTP_REQUEST_MINUTES, isGstForm, periodLabelOf, type AgentOtpRequestView } from '@/lib/gstzen/types';

/**
 * AGENT OTP REQUESTS REPOSITORY — `agent_otp_requests`: a "Your turn: type the OTP" request shown to
 * a staff member or to the client (MASTER-PLAN screens 7 and 8).
 *
 * Decision B7: an OTP is never stored. Nothing in this module takes, returns or writes an OTP; the
 * route hands the typed OTP straight to GSTZen and then records only that the request was answered
 * (who and when), failed or expired.
 *
 * >>> ACCESS CONTROL <<<
 *   create, list, cancel — staff on the engagement (admins all, a manager owned or co-managed, a lead
 *           assigned).
 *   client  — `listMyPendingOtpRequests` lists only requests with audience `client` on the client's
 *           own engagements; `loadOtpRequestForAnswer` lets a client answer only those.
 *   staff answer — staff on the engagement may answer either audience (the client may read the OTP
 *           out on a call).
 *   system  — `systemExpireOtpRequests` for jobs.
 */

export type OtpPurpose = 'gstn_consent' | 'evc';
export type OtpSubjectType = 'gst_return_run' | 'gstn_session' | 'live_browser_session';
type Row = typeof agentOtpRequests.$inferSelect;

/** The only fields a request is created with. There is no OTP field. */
export interface CreateOtpRequestInput {
  engagementId: string;
  purpose: OtpPurpose;
  subjectType: OtpSubjectType;
  subjectId: string;
  gstin: string | null;
  sentTo: string | null;
  audience: 'staff' | 'client';
}

function titleOf(r: Row, run?: { form: string; period: string } | null): string {
  if (run && isGstForm(run.form)) {
    const what = `${GST_FORM_LABEL[run.form]} (${periodLabelOf(run.form, run.period)})`;
    return r.purpose === 'evc' ? `SBC is filing your ${what}. The GST portal sent an EVC OTP to the authorised signatory.` : `SBC is filing your ${what}. The GST portal sent a consent OTP.`;
  }
  return r.purpose === 'evc' ? 'SBC is filing a GST return. The GST portal sent an EVC OTP.' : 'SBC asked the GST portal for your consent to read your GST returns.';
}

export function toOtpRequestView(r: Row, run?: { form: string; period: string } | null, now = new Date()): AgentOtpRequestView {
  const status = r.status === 'pending' && r.expiresAt.getTime() <= now.getTime() ? 'expired' : (r.status as AgentOtpRequestView['status']);
  return {
    id: r.id,
    engagementId: appEngagementId(r.engagementId),
    purpose: r.purpose as OtpPurpose,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    gstin: r.gstin,
    sentTo: r.sentTo,
    audience: r.audience === 'client' ? 'client' : 'staff',
    status,
    requestedAt: r.requestedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    title: titleOf(r, run),
  };
}

async function runsFor(rows: Row[]): Promise<Map<string, { form: string; period: string }>> {
  const ids = rows.filter((r) => r.subjectType === 'gst_return_run').map((r) => r.subjectId);
  if (!ids.length) return new Map();
  const runs = await db.select({ id: gstReturnRuns.id, form: gstReturnRuns.form, period: gstReturnRuns.period }).from(gstReturnRuns).where(inArray(gstReturnRuns.id, ids));
  return new Map(runs.map((r) => [r.id, r]));
}

/**
 * Opens a request. Any earlier pending request for the same subject and purpose is cancelled, so
 * only one OTP box shows at a time.
 */
export async function createOtpRequest(ctx: AuthContext, input: CreateOtpRequestInput, now = new Date()): Promise<AgentOtpRequestView> {
  const { dbId } = await staffEngagement(ctx, input.engagementId);
  await db
    .update(agentOtpRequests)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(agentOtpRequests.engagementId, dbId),
        eq(agentOtpRequests.subjectType, input.subjectType),
        eq(agentOtpRequests.subjectId, input.subjectId),
        eq(agentOtpRequests.purpose, input.purpose),
        eq(agentOtpRequests.status, 'pending'),
      ),
    );
  const [row] = await db
    .insert(agentOtpRequests)
    .values({
      engagementId: dbId,
      purpose: input.purpose,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      gstin: input.gstin,
      sentTo: input.sentTo,
      audience: input.audience,
      status: 'pending',
      requestedBy: ctx.userId,
      requestedAt: now,
      expiresAt: new Date(now.getTime() + OTP_REQUEST_MINUTES * 60_000),
    })
    .returning();
  const runs = await runsFor([row!]);
  return toOtpRequestView(row!, runs.get(row!.subjectId), now);
}

/** Pending requests on one subject (the card's "Your turn" boxes). Staff only. */
export async function listOtpRequestsFor(ctx: AuthContext, input: { engagementId: string; subjectType: OtpSubjectType; subjectId: string }, now = new Date()): Promise<AgentOtpRequestView[]> {
  const { dbId } = await staffEngagement(ctx, input.engagementId);
  const rows = await db
    .select()
    .from(agentOtpRequests)
    .where(
      and(
        eq(agentOtpRequests.engagementId, dbId),
        eq(agentOtpRequests.subjectType, input.subjectType),
        eq(agentOtpRequests.subjectId, input.subjectId),
        eq(agentOtpRequests.status, 'pending'),
        gt(agentOtpRequests.expiresAt, now),
      ),
    )
    .orderBy(desc(agentOtpRequests.requestedAt));
  const runs = await runsFor(rows);
  return rows.map((r) => toOtpRequestView(r, runs.get(r.subjectId), now));
}

/** The client's own pending requests (audience client), newest first. Clients only. */
export async function listMyPendingOtpRequests(ctx: AuthContext, now = new Date()): Promise<AgentOtpRequestView[]> {
  if (ctx.role !== 'client') throw new GstAgentError('Only a client has a client "Your turn" list.', 403);
  const ids = await listScopedEngagementIds(ctx);
  if (!ids.length) return [];
  const rows = await db
    .select({ r: agentOtpRequests })
    .from(agentOtpRequests)
    .innerJoin(engagements, eq(engagements.id, agentOtpRequests.engagementId))
    .where(
      and(
        inArray(agentOtpRequests.engagementId, ids),
        isNull(engagements.deletedAt),
        eq(agentOtpRequests.audience, 'client'),
        eq(agentOtpRequests.status, 'pending'),
        gt(agentOtpRequests.expiresAt, now),
      ),
    )
    .orderBy(desc(agentOtpRequests.requestedAt))
    .then((x) => x.map((y) => y.r));
  const runs = await runsFor(rows);
  return rows.map((r) => toOtpRequestView(r, runs.get(r.subjectId), now));
}

/**
 * The request a person is about to answer, checked: in their scope, open, not expired, and (for a
 * client) addressed to the client. An expired request is marked expired and answers 410.
 */
export async function loadOtpRequestForAnswer(ctx: AuthContext, requestId: string, now = new Date()): Promise<Row> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new GstAgentError('Request not found.', 404);
  const [row] = await db.select().from(agentOtpRequests).where(eq(agentOtpRequests.id, requestId)).limit(1);
  if (!row) throw new GstAgentError('Request not found.', 404);
  if (ctx.role === 'client') {
    if (row.audience !== 'client') throw new GstAgentError('Request not found.', 404);
    await anyEngagement(ctx, row.engagementId).catch(() => {
      throw new GstAgentError('Request not found.', 404);
    });
  } else {
    if (!isGstAgentStaff(ctx)) throw new GstAgentError('Not permitted.', 403);
    await staffEngagement(ctx, row.engagementId);
  }
  if (row.status !== 'pending') throw new GstAgentError(row.status === 'answered' ? 'This OTP was already sent.' : 'This request is closed. Ask for a new OTP.', 409);
  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.update(agentOtpRequests).set({ status: 'expired' }).where(eq(agentOtpRequests.id, row.id));
    throw new GstAgentError('The OTP request expired. Ask for a new OTP.', 410);
  }
  return row;
}

/** Records who answered and when. The OTP itself went to GSTZen and is not kept. */
export async function markOtpAnswered(ctx: AuthContext, requestId: string, now = new Date()): Promise<void> {
  await db
    .update(agentOtpRequests)
    .set({ status: 'answered', answeredBy: ctx.userId, answeredAt: now })
    .where(and(eq(agentOtpRequests.id, requestId), eq(agentOtpRequests.status, 'pending')));
}

/** The answer was refused for a reason a retry cannot fix (the request stays closed). */
export async function markOtpFailed(ctx: AuthContext, requestId: string, now = new Date()): Promise<void> {
  await db
    .update(agentOtpRequests)
    .set({ status: 'failed', answeredBy: ctx.userId, answeredAt: now })
    .where(and(eq(agentOtpRequests.id, requestId), eq(agentOtpRequests.status, 'pending')));
}

/** Staff close a pending request (for example when the run is cancelled). */
export async function cancelOtpRequestsFor(ctx: AuthContext, input: { engagementId: string; subjectType: OtpSubjectType; subjectId: string }): Promise<void> {
  const { dbId } = await staffEngagement(ctx, input.engagementId);
  await db
    .update(agentOtpRequests)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(agentOtpRequests.engagementId, dbId),
        eq(agentOtpRequests.subjectType, input.subjectType),
        eq(agentOtpRequests.subjectId, input.subjectId),
        eq(agentOtpRequests.status, 'pending'),
      ),
    );
}

/** Marks every pending request past its expiry as expired. Jobs only. */
export async function systemExpireOtpRequests(now = new Date()): Promise<number> {
  const rows = await db
    .update(agentOtpRequests)
    .set({ status: 'expired' })
    .where(and(eq(agentOtpRequests.status, 'pending'), lte(agentOtpRequests.expiresAt, now)))
    .returning({ id: agentOtpRequests.id });
  return rows.length;
}
