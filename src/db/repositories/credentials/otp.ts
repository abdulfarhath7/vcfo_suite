import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { credentialAccessGrants, credentialOtps } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { hashOtp, newOtpCode, otpMatches } from '@/lib/credentials-crypto';
import { sendEmail } from '@/lib/email/send-email';
import {
  isValidScope,
  maskEmail,
  scopeLabel,
  type CredMode,
} from '@/lib/client-portal/credentials';
import {
  CredentialsError,
  SESSION_MS,
  OTP_TTL_MS,
  RESEND_MS,
  LOCK_MS,
  MAX_TRIES,
  OTP_REQUESTS_PER_HOUR,
  type Access,
  resolveAccess,
} from './access';
import { build } from './workbook';

/* ------------------------------------------------------------------ */
/* OTP: request, resend, verify; grants                                 */
/* ------------------------------------------------------------------ */

function verbOf(mode: CredMode): string {
  return mode === 'edit' ? 'Edit' : mode === 'preview' ? 'Preview' : 'Reveal';
}

async function approvers(dbId: string) {
  const r = await resolveEngagementRecipients(dbId);
  const managers = r?.managers?.length ? r.managers : r?.manager ? [r.manager] : [];
  // No Project Manager on the engagement → the Project Lead(s) approve (QUESTIONS.md).
  return managers.length ? managers : (r?.leads ?? []);
}

async function deliverOtp(ctx: AuthContext, acc: Access, code: string, mode: CredMode, label: string) {
  const to = await approvers(acc.dbId);
  if (!to.length) throw new CredentialsError('no_manager', 409);
  const who = ctx.name || ctx.email;
  const verb = verbOf(mode);
  const text = [
    `${who} (${acc.row.companyName}) asked to ${verb.toLowerCase()} ${label} on the Credentials page of VCFO Suite.`,
    '',
    `Code: ${code}`,
    '',
    'The code works for 10 minutes. Share it with them by phone or WhatsApp only if you expect this request.',
    'Every preview, edit and reveal is logged on the client’s Audit page.',
  ].join('\n');
  const html = `<p>${escapeHtml(who)} (${escapeHtml(acc.row.companyName)}) asked to <b>${verb.toLowerCase()} ${escapeHtml(label)}</b> on the Credentials page of VCFO Suite.</p>
<p style="font:700 28px/1.2 'IBM Plex Mono',monospace;letter-spacing:.2em">${code}</p>
<p>The code works for 10 minutes. Share it with them by phone or WhatsApp only if you expect this request.<br>Every preview, edit and reveal is logged on the client’s Audit page.</p>`;
  // WhatsApp is template-only (no free-text send) → email only; see QUESTIONS.md.
  await sendEmail({
    to: to.map((m) => m.email),
    subject: `Credentials access code for ${acc.row.companyName}`,
    text,
    html,
    purpose: 'credentials.otp',
  });
  return to[0]!;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function activeLock(ctx: AuthContext, dbId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lockedUntil: credentialOtps.lockedUntil })
    .from(credentialOtps)
    .where(
      and(
        eq(credentialOtps.engagementId, dbId),
        eq(credentialOtps.requestedBy, ctx.userId),
        gt(credentialOtps.lockedUntil, new Date()),
      ),
    )
    .orderBy(desc(credentialOtps.lockedUntil))
    .limit(1);
  return row?.lockedUntil ?? null;
}

export interface OtpTicket {
  otpId: string;
  manager: { name: string; emailMasked: string };
  resendAt: string;
  expiresAt: string;
  lockedUntil: string | null;
}

export async function requestCredentialOtp(
  ctx: AuthContext,
  input: { engagementId?: string | null; mode: CredMode; scope: string },
): Promise<OtpTicket> {
  if (!['preview', 'edit', 'reveal'].includes(input.mode) || !isValidScope(input.scope)) {
    throw new CredentialsError('invalid_scope', 400);
  }
  if (input.mode === 'reveal' && !input.scope.startsWith('cell:')) throw new CredentialsError('invalid_scope', 400);
  if (input.mode === 'edit' && (input.scope.startsWith('cell:') || input.scope.startsWith('row:ids'))) {
    throw new CredentialsError('invalid_scope', 400);
  }
  const acc = await resolveAccess(ctx, input.engagementId);
  if (acc.staff) throw new CredentialsError('staff_no_otp', 400);
  const locked = await activeLock(ctx, acc.dbId);
  if (locked) throw new CredentialsError('locked', 423, { lockedUntil: locked.toISOString() });

  // Security review H2: at most OTP_REQUESTS_PER_HOUR codes per person and
  // engagement, and only ONE live code — a new request retires the old ones.
  const [recent] = await db
    .select({ n: sql<number>`count(*)` })
    .from(credentialOtps)
    .where(
      and(
        eq(credentialOtps.requestedBy, ctx.userId),
        eq(credentialOtps.engagementId, acc.dbId),
        gt(credentialOtps.createdAt, new Date(Date.now() - 60 * 60_000)),
      ),
    );
  if (Number(recent?.n ?? 0) >= OTP_REQUESTS_PER_HOUR) throw new CredentialsError('too_many_requests', 429);
  await db
    .update(credentialOtps)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(credentialOtps.requestedBy, ctx.userId),
        eq(credentialOtps.engagementId, acc.dbId),
        isNull(credentialOtps.consumedAt),
      ),
    );

  const built = await build(ctx, acc);
  const label = scopeLabel(built.payload.sheets, built.payload.ids, input.scope);
  const id = randomUUID();
  const code = newOtpCode();
  const now = Date.now();
  const sentTo = await deliverOtp(ctx, acc, code, input.mode, label);
  await db.insert(credentialOtps).values({
    id,
    engagementId: acc.dbId,
    requestedBy: ctx.userId,
    approverProfileId: sentTo.userId,
    approverName: sentTo.name,
    mode: input.mode,
    scope: input.scope,
    codeHash: hashOtp(id, code),
    expiresAt: new Date(now + OTP_TTL_MS),
    resendAvailableAt: new Date(now + RESEND_MS),
  });
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'credentials.otp_requested',
    summary: `asked for an OTP to ${verbOf(input.mode).toLowerCase()} ${label} · sent to ${sentTo.name}`,
    metadata: { mode: input.mode, scope: input.scope, otpId: id },
  });
  return {
    otpId: id,
    manager: { name: sentTo.name, emailMasked: maskEmail(sentTo.email) },
    resendAt: new Date(now + RESEND_MS).toISOString(),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    lockedUntil: null,
  };
}

async function loadOwnOtp(ctx: AuthContext, otpId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(otpId)) throw new CredentialsError('not_found', 404);
  const [otp] = await db
    .select()
    .from(credentialOtps)
    .where(and(eq(credentialOtps.id, otpId), eq(credentialOtps.requestedBy, ctx.userId)))
    .limit(1);
  if (!otp || otp.consumedAt) throw new CredentialsError('not_found', 404);
  // Re-check the engagement is still the caller's (membership may have changed).
  const acc = await resolveAccess(ctx, otp.engagementId);
  if (acc.dbId !== otp.engagementId) throw new CredentialsError('forbidden', 403);
  return { otp, acc };
}

export async function resendCredentialOtp(ctx: AuthContext, otpId: string): Promise<OtpTicket> {
  const { otp, acc } = await loadOwnOtp(ctx, otpId);
  const now = Date.now();
  if (otp.lockedUntil && otp.lockedUntil.getTime() > now) {
    throw new CredentialsError('locked', 423, { lockedUntil: otp.lockedUntil.toISOString() });
  }
  if (otp.resendAvailableAt.getTime() > now) {
    throw new CredentialsError('resend_too_soon', 429, { resendAt: otp.resendAvailableAt.toISOString() });
  }
  const built = await build(ctx, acc);
  const label = scopeLabel(built.payload.sheets, built.payload.ids, otp.scope);
  const code = newOtpCode();
  const sentTo = await deliverOtp(ctx, acc, code, otp.mode as CredMode, label);
  await db
    .update(credentialOtps)
    .set({
      codeHash: hashOtp(otp.id, code),
      expiresAt: new Date(now + OTP_TTL_MS),
      resendAvailableAt: new Date(now + RESEND_MS),
      approverProfileId: sentTo.userId,
      approverName: sentTo.name,
    })
    .where(eq(credentialOtps.id, otp.id));
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'credentials.otp_requested',
    summary: `asked for a new OTP for ${label} · sent to ${sentTo.name}`,
    metadata: { mode: otp.mode, scope: otp.scope, otpId: otp.id, resend: true },
  });
  return {
    otpId: otp.id,
    manager: { name: sentTo.name, emailMasked: maskEmail(sentTo.email) },
    resendAt: new Date(now + RESEND_MS).toISOString(),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    lockedUntil: null,
  };
}

export type VerifyOutcome =
  | { ok: true; grant: { id: string; mode: CredMode; scope: string; expiresAt: string } }
  | { ok: false; error: 'wrong_code'; triesLeft: number }
  | { ok: false; error: 'locked'; lockedUntil: string }
  | { ok: false; error: 'expired' };

export async function verifyCredentialOtp(ctx: AuthContext, input: { otpId: string; code: string }): Promise<VerifyOutcome> {
  const { otp, acc } = await loadOwnOtp(ctx, input.otpId);
  const now = Date.now();
  if (otp.lockedUntil && otp.lockedUntil.getTime() > now) {
    return { ok: false, error: 'locked', lockedUntil: otp.lockedUntil.toISOString() };
  }
  if (otp.expiresAt.getTime() <= now) return { ok: false, error: 'expired' };
  const code = String(input.code ?? '').replace(/\D/g, '');
  // Security review H2: count the try ATOMICALLY before comparing, so parallel
  // guesses cannot all read the same counter. A lock that has run out starts
  // the count again (prototype: 3 more tries).
  const nowDate = new Date(now);
  const bumped = await db
    .update(credentialOtps)
    .set({
      attempts: sql`case when ${credentialOtps.lockedUntil} is not null and ${credentialOtps.lockedUntil} <= ${nowDate} then 1 else ${credentialOtps.attempts} + 1 end`,
      lockedUntil: sql`case when ${credentialOtps.lockedUntil} <= ${nowDate} then null else ${credentialOtps.lockedUntil} end`,
    })
    .where(
      and(
        eq(credentialOtps.id, otp.id),
        isNull(credentialOtps.consumedAt),
        or(isNull(credentialOtps.lockedUntil), sql`${credentialOtps.lockedUntil} <= ${nowDate}`),
      ),
    )
    .returning({ attempts: credentialOtps.attempts, lockedUntil: credentialOtps.lockedUntil });
  const attempts = bumped[0]?.attempts;
  if (attempts == null) {
    const [cur] = await db.select({ lockedUntil: credentialOtps.lockedUntil }).from(credentialOtps).where(eq(credentialOtps.id, otp.id)).limit(1);
    if (cur?.lockedUntil) return { ok: false, error: 'locked', lockedUntil: cur.lockedUntil.toISOString() };
    throw new CredentialsError('not_found', 404);
  }
  if (attempts > MAX_TRIES || code.length !== 6 || !otpMatches(otp.id, code, otp.codeHash)) {
    if (attempts >= MAX_TRIES) {
      const lockedUntil = new Date(now + LOCK_MS);
      await db.update(credentialOtps).set({ attempts: 0, lockedUntil }).where(eq(credentialOtps.id, otp.id));
      void recordAuditEvent(ctx, {
        engagementId: acc.dbId,
        action: 'credentials.otp_locked',
        summary: 'entered 3 wrong codes · locked for 60 seconds',
        metadata: { otpId: otp.id, scope: otp.scope },
      });
      return { ok: false, error: 'locked', lockedUntil: lockedUntil.toISOString() };
    }
    return { ok: false, error: 'wrong_code', triesLeft: MAX_TRIES - attempts };
  }

  // Consume atomically: only one verify can turn this OTP into a grant.
  const consumed = await db
    .update(credentialOtps)
    .set({ consumedAt: new Date(now) })
    .where(and(eq(credentialOtps.id, otp.id), isNull(credentialOtps.consumedAt)))
    .returning({ id: credentialOtps.id });
  if (!consumed.length) throw new CredentialsError('not_found', 404);

  const expiresAt = new Date(now + SESSION_MS);
  const [g] = await db
    .insert(credentialAccessGrants)
    .values({
      engagementId: acc.dbId,
      profileId: ctx.userId,
      mode: otp.mode,
      scope: otp.scope,
      expiresAt,
      approvedBy: otp.approverProfileId,
      otpId: otp.id,
    })
    .returning({ id: credentialAccessGrants.id });

  const built = await build(ctx, acc);
  const label = scopeLabel(built.payload.sheets, built.payload.ids, otp.scope);
  const approver = otp.approverName ?? 'the Project Manager';
  const mode = otp.mode as CredMode;
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: mode === 'reveal' ? 'credentials.reveal' : mode === 'edit' ? 'credentials.edit' : 'credentials.preview',
    summary:
      mode === 'reveal'
        ? `revealed ${label} · OTP approved by ${approver}`
        : `started ${verbOf(mode)} · ${label} · OTP approved by ${approver}`,
    metadata: { scope: otp.scope, mode, grantId: g!.id, approvedBy: otp.approverProfileId },
  });
  return { ok: true, grant: { id: g!.id, mode, scope: otp.scope, expiresAt: expiresAt.toISOString() } };
}

/** Lock / Hide: end the caller's live grants on exactly this scope. */
export async function lockCredentialScope(ctx: AuthContext, input: { engagementId?: string | null; scope: string }): Promise<void> {
  if (!isValidScope(input.scope)) throw new CredentialsError('invalid_scope', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  const ended = await db
    .update(credentialAccessGrants)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(credentialAccessGrants.engagementId, acc.dbId),
        eq(credentialAccessGrants.profileId, ctx.userId),
        eq(credentialAccessGrants.scope, input.scope),
        isNull(credentialAccessGrants.revokedAt),
        gt(credentialAccessGrants.expiresAt, new Date()),
      ),
    )
    .returning({ id: credentialAccessGrants.id });
  if (ended.length) {
    const built = await build(ctx, acc);
    void recordAuditEvent(ctx, {
      engagementId: acc.dbId,
      action: 'credentials.lock',
      summary: `${input.scope.startsWith('cell:') ? 'hid' : 'locked'} ${scopeLabel(built.payload.sheets, built.payload.ids, input.scope)}`,
      metadata: { scope: input.scope },
    });
  }
}
