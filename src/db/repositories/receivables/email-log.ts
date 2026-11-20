import 'server-only';
import { and, desc, eq, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { outlookConnections, profiles, receivableEmailLog } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { AUTO_EMAIL_KINDS, MANUAL_EMAIL_KINDS, type EmailKind, type EmailLogDto, type EmailLogEntryDto, type EmailLogFilter, type EmailLogPageDto, type EmailStatus, type WhatsAppPingStatus } from '@/lib/receivables/v2-wire';
import { UUID, conflict, notFound, scopedSheet } from './shared';

/**
 * RECEIVABLES v2 — the email log (docs/specs/receivables/V2.md). One row per new invoice, revised,
 * roll-up, digest or client statement email. A row is written as `sending` before the send, so a
 * send that dies half way still shows; the outcome and the WhatsApp ping to the sender are written
 * on the same row afterwards.
 *
 * The functions that take an AuthContext go through `scopedSheet`. The `system*` ones are called
 * only by the Inngest jobs (src/jobs/receivables-*.ts) and by `after()` work that a scoped route
 * already checked; they skip `ctx` because the job has no caller.
 */

export type EmailLogRow = typeof receivableEmailLog.$inferSelect;

export type NewEmailLog = {
  sheetId: string;
  kind: EmailKind;
  partnerId?: string | null;
  clientId?: string | null;
  periodKey?: string | null;
  /** Once-per-period key of an automatic send; a second insert with the same key is refused. */
  dedupeKey?: string | null;
  recipientName: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  senderUserId: string | null;
  invoiceIds?: string[];
  about: string;
  /** `skipped` (with `error`) records a send that was never tried, for example no Outlook. */
  status?: EmailStatus;
  error?: string | null;
};

function values(input: NewEmailLog) {
  return {
    sheetId: input.sheetId,
    kind: input.kind,
    partnerId: input.partnerId ?? null,
    clientId: input.clientId ?? null,
    periodKey: input.periodKey ?? null,
    dedupeKey: input.dedupeKey ?? null,
    recipientName: input.recipientName,
    to: input.to,
    cc: input.cc ?? [],
    subject: input.subject,
    html: input.html,
    text: input.text,
    senderUserId: input.senderUserId,
    invoiceIds: input.invoiceIds ?? [],
    about: input.about,
    status: input.status ?? 'sending',
    error: input.error ?? null,
  };
}

/**
 * SYSTEM: writes a log row for a job's automatic send. Returns null when the dedupe key is already
 * taken, which means this period's email was already sent (or is being sent) and must not go twice.
 */
export async function systemStartEmailLog(input: NewEmailLog): Promise<EmailLogRow | null> {
  const [row] = await db.insert(receivableEmailLog).values(values(input)).onConflictDoNothing().returning();
  return row ?? null;
}

/** A manual send (Send statement) by the signed-in person, logged before it goes. */
export async function startEmailLog(ctx: AuthContext, input: Omit<NewEmailLog, 'senderUserId' | 'dedupeKey'>): Promise<EmailLogRow> {
  const sheet = await scopedSheet(ctx, input.sheetId);
  const [row] = await db
    .insert(receivableEmailLog)
    .values(values({ ...input, sheetId: sheet.id, senderUserId: ctx.userId, dedupeKey: null }))
    .returning();
  return row;
}

/** SYSTEM: the outcome of a send. */
export async function systemFinishEmailLog(id: string, outcome: { status: EmailStatus; error?: string | null; webLink?: string | null }): Promise<void> {
  await db
    .update(receivableEmailLog)
    .set({ status: outcome.status, error: outcome.error ?? null, ...(outcome.status === 'sent' ? { sentAt: new Date(), webLink: outcome.webLink ?? null } : {}) })
    .where(eq(receivableEmailLog.id, id));
}

/** SYSTEM: the WhatsApp ping's outcome. */
export async function systemSetEmailWhatsApp(id: string, status: WhatsAppPingStatus): Promise<void> {
  await db.update(receivableEmailLog).set({ whatsappStatus: status }).where(eq(receivableEmailLog.id, id));
}

/** SYSTEM: one log row and its sender's name and WhatsApp number, for the send and the ping. */
export async function systemGetEmailLog(id: string): Promise<(EmailLogRow & { senderName: string | null; senderPhone: string | null }) | null> {
  if (!UUID.test(id ?? '')) return null;
  const [row] = await db
    .select({ log: receivableEmailLog, senderName: profiles.name, senderPhone: profiles.phoneE164 })
    .from(receivableEmailLog)
    .leftJoin(profiles, eq(profiles.id, receivableEmailLog.senderUserId))
    .where(eq(receivableEmailLog.id, id))
    .limit(1);
  return row ? { ...row.log, senderName: row.senderName ?? null, senderPhone: row.senderPhone ?? null } : null;
}

function toDto(row: EmailLogRow, senderName: string | null, who?: { email: string | null; phone: string | null }): EmailLogDto {
  return {
    ...(who ? { senderEmail: who.email, senderPhone: who.phone } : {}),
    id: row.id,
    kind: row.kind as EmailKind,
    recipientName: row.recipientName,
    to: row.to ?? [],
    cc: row.cc ?? [],
    subject: row.subject,
    senderName,
    status: row.status as EmailStatus,
    error: row.error,
    whatsappStatus: (row.whatsappStatus as WhatsAppPingStatus | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    invoiceCount: row.invoiceIds?.length ?? 0,
  };
}

const KINDS = new Set<string>([...AUTO_EMAIL_KINDS, ...MANUAL_EMAIL_KINDS]);
const STATUSES = new Set<string>(['awaiting', 'sending', 'sent', 'failed', 'skipped']);

/**
 * The Email log tab (owner, 19 Nov 2026): every email of the sheet, automatic and manual, newest
 * first, 50 a page. `before` is the `createdAt` of the last row already shown. The search matches
 * the subject, the recipient's name and every To or Cc address.
 */
export async function listEmailLogPage(ctx: AuthContext, sheetId: string, filter: EmailLogFilter & { before?: string | null; limit?: number }): Promise<EmailLogPageDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const where: SQL[] = [eq(receivableEmailLog.sheetId, sheet.id)];
  if (filter.origin === 'auto') where.push(inArray(receivableEmailLog.kind, [...AUTO_EMAIL_KINDS]));
  if (filter.origin === 'manual') where.push(inArray(receivableEmailLog.kind, [...MANUAL_EMAIL_KINDS]));
  if (filter.kind && KINDS.has(filter.kind)) where.push(eq(receivableEmailLog.kind, filter.kind));
  if (filter.status && STATUSES.has(filter.status)) where.push(eq(receivableEmailLog.status, filter.status));
  const q = filter.q?.trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      or(
        ilike(receivableEmailLog.subject, like),
        ilike(receivableEmailLog.recipientName, like),
        sql`array_to_string(${receivableEmailLog.to} || ${receivableEmailLog.cc}, ' ') ilike ${like}`,
      )!,
    );
  }
  const before = filter.before ? new Date(filter.before) : null;
  if (before && !Number.isNaN(before.getTime())) where.push(lt(receivableEmailLog.createdAt, before));
  const rows = await db
    .select({ log: receivableEmailLog, senderName: profiles.name, senderEmail: outlookConnections.msEmail, senderPhone: profiles.phoneE164 })
    .from(receivableEmailLog)
    .leftJoin(profiles, eq(profiles.id, receivableEmailLog.senderUserId))
    .leftJoin(outlookConnections, eq(outlookConnections.userId, receivableEmailLog.senderUserId))
    .where(and(...where))
    .orderBy(desc(receivableEmailLog.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit).map((r) => toDto(r.log, r.senderName ?? null, { email: r.senderEmail ?? null, phone: r.senderPhone ?? null }));
  return { rows: page, nextBefore: rows.length > limit ? page[page.length - 1]!.createdAt : null };
}

/** One email in full (its HTML), for the Email log's viewer. */
export async function getEmailLogEntry(ctx: AuthContext, id: string): Promise<EmailLogEntryDto> {
  if (!UUID.test(id ?? '')) throw notFound();
  const [row] = await db
    .select({ log: receivableEmailLog, senderName: profiles.name, senderEmail: outlookConnections.msEmail, senderPhone: profiles.phoneE164 })
    .from(receivableEmailLog)
    .leftJoin(profiles, eq(profiles.id, receivableEmailLog.senderUserId))
    .leftJoin(outlookConnections, eq(outlookConnections.userId, receivableEmailLog.senderUserId))
    .where(eq(receivableEmailLog.id, id))
    .limit(1);
  if (!row) throw notFound();
  await scopedSheet(ctx, row.log.sheetId);
  return { ...toDto(row.log, row.senderName ?? null, { email: row.senderEmail ?? null, phone: row.senderPhone ?? null }), html: row.log.html, about: row.log.about, webLink: row.log.webLink };
}

/** The last `limit` emails of the sheet, newest first (the People tab's log). */
export async function listEmailLog(ctx: AuthContext, sheetId: string, limit = 50): Promise<EmailLogDto[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  const rows = await db
    .select({ log: receivableEmailLog, senderName: profiles.name })
    .from(receivableEmailLog)
    .leftJoin(profiles, eq(profiles.id, receivableEmailLog.senderUserId))
    .where(eq(receivableEmailLog.sheetId, sheet.id))
    .orderBy(desc(receivableEmailLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map((r) => toDto(r.log, r.senderName ?? null));
}

/**
 * Retry of a failed or skipped email: the row goes back to `sending`, now from the clicker's
 * Outlook, and the caller sends its stored HTML again.
 */
export async function retryEmailLog(ctx: AuthContext, id: string): Promise<EmailLogRow> {
  if (!UUID.test(id ?? '')) throw notFound();
  const [row] = await db.select().from(receivableEmailLog).where(eq(receivableEmailLog.id, id)).limit(1);
  if (!row) throw notFound();
  const sheet = await scopedSheet(ctx, row.sheetId);
  if (row.status !== 'failed' && row.status !== 'skipped') throw conflict('not_failed');
  // A Send email goes again from the Sheet tab, which checks the received invoices first.
  if (row.kind === 'summary') throw conflict('resend_from_sheet');
  const [updated] = await db
    .update(receivableEmailLog)
    .set({ status: 'sending', error: null, whatsappStatus: null, senderUserId: ctx.userId })
    .where(and(eq(receivableEmailLog.id, row.id), eq(receivableEmailLog.sheetId, sheet.id)))
    .returning();
  return updated;
}

/* ---- Approval before any automatic email (owner, 20 Nov 2026) ---------------------------- */

/**
 * SYSTEM: a newer roll-up or digest replaces the older one still waiting for the same person, so a
 * partner never gets two. The older row ends `skipped` with the reason `replaced`.
 */
export async function systemReplaceAwaiting(sheetId: string, kind: EmailKind, partnerId: string | null, keepId: string): Promise<void> {
  const rows = await db
    .select({ id: receivableEmailLog.id, partnerId: receivableEmailLog.partnerId })
    .from(receivableEmailLog)
    .where(and(eq(receivableEmailLog.sheetId, sheetId), eq(receivableEmailLog.kind, kind), eq(receivableEmailLog.status, 'awaiting')));
  const old = rows.filter((r) => r.id !== keepId && (r.partnerId ?? null) === partnerId).map((r) => r.id);
  if (old.length) await db.update(receivableEmailLog).set({ status: 'skipped', error: 'replaced' }).where(inArray(receivableEmailLog.id, old));
}

/**
 * Approve: the waiting emails go to `sending` from the approver's Outlook, with the words the
 * approver may have changed (`html` by id). Only rows of this sheet that still wait are taken, so a
 * second click sends nothing twice. Returns the ids to send.
 */
export async function approveEmailLogs(ctx: AuthContext, sheetId: string, ids: string[], html: Record<string, string> = {}): Promise<string[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  const valid = ids.filter((id) => UUID.test(id ?? ''));
  if (!valid.length) return [];
  const taken: string[] = [];
  for (const id of valid) {
    const [row] = await db
      .update(receivableEmailLog)
      .set({ status: 'sending', error: null, senderUserId: ctx.userId, ...(html[id] ? { html: html[id] } : {}) })
      .where(and(eq(receivableEmailLog.id, id), eq(receivableEmailLog.sheetId, sheet.id), eq(receivableEmailLog.status, 'awaiting')))
      .returning({ id: receivableEmailLog.id });
    if (row) taken.push(row.id);
  }
  return taken;
}

/** Skip: the waiting emails are never sent; the row keeps who skipped it. */
export async function skipEmailLogs(ctx: AuthContext, sheetId: string, ids: string[]): Promise<number> {
  const sheet = await scopedSheet(ctx, sheetId);
  const valid = ids.filter((id) => UUID.test(id ?? ''));
  if (!valid.length) return 0;
  const rows = await db
    .update(receivableEmailLog)
    .set({ status: 'skipped', error: 'skipped', senderUserId: ctx.userId })
    .where(and(inArray(receivableEmailLog.id, valid), eq(receivableEmailLog.sheetId, sheet.id), eq(receivableEmailLog.status, 'awaiting')))
    .returning({ id: receivableEmailLog.id });
  return rows.length;
}
