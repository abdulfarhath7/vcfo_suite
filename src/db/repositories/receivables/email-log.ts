import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, receivableEmailLog } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { EmailKind, EmailLogDto, EmailStatus, WhatsAppPingStatus } from '@/lib/receivables/v2-wire';
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

function toDto(row: EmailLogRow, senderName: string | null): EmailLogDto {
  return {
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
  };
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
  const [updated] = await db
    .update(receivableEmailLog)
    .set({ status: 'sending', error: null, whatsappStatus: null, senderUserId: ctx.userId })
    .where(and(eq(receivableEmailLog.id, row.id), eq(receivableEmailLog.sheetId, sheet.id)))
    .returning();
  return updated;
}
