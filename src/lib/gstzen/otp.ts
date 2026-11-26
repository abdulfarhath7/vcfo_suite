import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { createOtpRequest, loadOtpRequestForAnswer, markOtpAnswered } from '@/db/repositories/agent-otp';
import { getRegistrationLogin } from '@/db/repositories/credentials';
import { GstAgentError, isGstAgentStaff } from '@/db/repositories/gst-agent-scope';
import { getGstReturnRun, systemGetRun, systemUpdateRun } from '@/db/repositories/gst-returns';
import { getEngagementGstnSession, recordGstnSessionEstablished } from '@/db/repositories/gstn-sessions';
import { GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { GstzenError, gstzen } from './client';
import { gstzenGate } from './gate';
import { gstinMissingInAccount, sessionExpiryOf } from './mappers';
import { fileReturnWithEvc } from './returns';
import { queueReturnWork } from './work';
import { OTP_RE, type AgentOtpRequestView } from './types';

/**
 * CONSENT AND OTP ANSWERS (decision B7). The consent OTP is the taxpayer's consent for the GSP to
 * open a GSTN session; the EVC OTP signs the return. Either one is typed by a person (staff, or the
 * client in the client portal), goes straight to GSTZen inside the same request, and is never stored,
 * logged, audited or queued. Suite records only that it was asked for and answered.
 */

/**
 * The client's GST portal username from where Suite keeps it: the credentials workbook's GST login
 * row (never the password). The workbook shows the GSTIN in that cell until someone types the real
 * username, so a value equal to the GSTIN is not a username.
 */
async function storedPortalUsername(ctx: AuthContext, engagementId: string, gstin: string): Promise<string | null> {
  try {
    const login = await getRegistrationLogin(ctx, { engagementId, stepId: GST_STEP_ID });
    const u = login.username.trim();
    return u && u.toUpperCase() !== gstin ? u : null;
  } catch {
    return null;
  }
}

export type ConsentResult = { ok: true; request: AgentOtpRequestView } | { ok: false; needsUsername: true; message: string };

/**
 * Asks the GST portal (through GSTZen) to send the consent OTP to the taxpayer's registered mobile,
 * and opens the "Your turn" request for the staff member or the client. A GSTIN not yet in the firm's
 * GSTZen account is added once and the OTP asked again.
 */
export async function requestConsentOtp(
  ctx: AuthContext,
  input: { engagementId: string; audience: 'staff' | 'client'; username?: string | null; runId?: string | null },
): Promise<ConsentResult> {
  if (!isGstAgentStaff(ctx)) throw new GstAgentError('Only firm staff can ask for the consent OTP.', 403);
  const gate = await gstzenGate(ctx.userId);
  if (gate.open === false) throw new GstAgentError(gate.message, 503);
  const s = await getEngagementGstnSession(ctx, input.engagementId);
  if (!s.gstin) throw new GstAgentError('Record the GSTIN on the GST registration first.', 409);
  const gstin = s.gstin;
  if (input.runId) {
    const run = await getGstReturnRun(ctx, input.runId);
    if (run.gstin !== gstin) throw new GstAgentError('The return was started on another GSTIN. Start it again.', 409);
  }

  const typed = input.username?.trim() || null;
  if (typed && (typed.length > 60 || /\s/.test(typed))) throw new GstAgentError('That does not look like a GST portal username.', 400);
  const username = typed ?? (await storedPortalUsername(ctx, input.engagementId, gstin));
  if (!username) {
    return { ok: false, needsUsername: true, message: 'Suite does not hold the client’s GST portal username. Type it here; it is used for this request only.' };
  }

  const api = gstzen();
  try {
    try {
      await api.generateOtp(gstin, username);
    } catch (e) {
      if (!(e instanceof GstzenError && e.kind === 'portal' && gstinMissingInAccount(e.message))) throw e;
      await api.createGstin(gstin, s.companyName);
      await api.generateOtp(gstin, username);
    }
  } catch (e) {
    if (e instanceof GstzenError) throw new GstAgentError(e.message, 422);
    throw e;
  }

  const request = await createOtpRequest(ctx, {
    engagementId: input.engagementId,
    purpose: 'gstn_consent',
    subjectType: input.runId ? 'gst_return_run' : 'gstn_session',
    subjectId: input.runId ?? gstin,
    gstin,
    sentTo: 'the mobile registered on the GST portal',
    audience: input.audience,
  });
  await recordAuditEvent(ctx, {
    engagementId: input.engagementId,
    action: 'gstzen.consent.requested',
    summary: `Consent OTP requested for GSTIN ${gstin}`,
    metadata: { gstin, audience: input.audience, runId: input.runId ?? null, username: typed ? 'typed' : 'workbook' },
  });
  return { ok: true, request };
}

export type AnswerResult = { purpose: 'gstn_consent'; sessionExpiresAt: string | null } | { purpose: 'evc'; arn: string };

/**
 * One typed OTP, for either purpose. Staff on the engagement answer any request; a client answers
 * only a request addressed to the client. A wrong OTP keeps the request open until it expires.
 */
export async function answerOtpRequest(ctx: AuthContext, requestId: string, otpInput: string): Promise<AnswerResult> {
  const otp = String(otpInput ?? '').trim();
  if (!OTP_RE.test(otp)) throw new GstAgentError('The OTP is six digits.', 400);
  const req = await loadOtpRequestForAnswer(ctx, requestId);
  const gate = await gstzenGate(req.requestedBy ?? ctx.userId);
  if (gate.open === false) throw new GstAgentError(gate.message, 503);
  if (!req.gstin) throw new GstAgentError('This request has no GSTIN.', 409);

  if (req.purpose === 'evc') {
    if (req.subjectType !== 'gst_return_run') throw new GstAgentError('This request is not for a GST return.', 409);
    try {
      const { arn } = await fileReturnWithEvc(ctx, req.subjectId, otp);
      await markOtpAnswered(ctx, req.id);
      return { purpose: 'evc', arn };
    } catch (e) {
      await recordAuditEvent(ctx, {
        engagementId: req.engagementId,
        action: 'gstzen.evc.refused',
        summary: 'The EVC was refused',
        metadata: { requestId: req.id, runId: req.subjectId, error: e instanceof Error ? e.message : 'error' },
        result: 'failed',
      });
      throw e;
    }
  }

  let message: unknown;
  try {
    message = await gstzen().establishSession(req.gstin, otp);
  } catch (e) {
    await recordAuditEvent(ctx, {
      engagementId: req.engagementId,
      action: 'gstzen.consent.refused',
      summary: `The consent OTP for GSTIN ${req.gstin} was refused`,
      metadata: { requestId: req.id, gstin: req.gstin },
      result: 'failed',
    });
    if (e instanceof GstzenError) throw new GstAgentError(e.message, 422);
    throw e;
  }
  const now = new Date();
  const session = await recordGstnSessionEstablished(ctx, { engagementId: req.engagementId, gstin: req.gstin, expiresAt: sessionExpiryOf(message, now) }, now);
  await markOtpAnswered(ctx, req.id, now);
  await recordAuditEvent(ctx, {
    engagementId: req.engagementId,
    action: 'gstzen.consent.given',
    summary: `GSTN session established for GSTIN ${req.gstin}`,
    metadata: { requestId: req.id, gstin: req.gstin, expiresAt: session.expiresAt, by: ctx.role === 'client' ? 'client' : 'staff' },
  });

  // A run waiting for consent starts its save now.
  if (req.subjectType === 'gst_return_run') {
    const run = await systemGetRun(req.subjectId);
    if (run?.status === 'consent_needed') {
      await systemUpdateRun(run.id, { status: 'saving', error: null, flow: { working: 'save' } });
      await queueReturnWork(run.id, 'save');
    }
  }
  return { purpose: 'gstn_consent', sessionExpiresAt: session.expiresAt };
}
