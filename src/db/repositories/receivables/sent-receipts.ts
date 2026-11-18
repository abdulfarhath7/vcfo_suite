import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { receivableInvoices, receivableSentReceipts } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { SentMap } from '@/lib/receivables/sent-receipts';
import { UUID, scopedSheet } from './shared';

/**
 * Received invoices already emailed to a person (owner, 18 Nov 2026). Read through `scopedSheet`;
 * written by the send paths after an email went out.
 */

/** Who each of these invoices was already sent to. */
export async function sentReceiptsFor(ctx: AuthContext, sheetId: string, invoiceIds: string[]): Promise<SentMap> {
  const sheet = await scopedSheet(ctx, sheetId);
  const ids = [...new Set(invoiceIds)].filter((id) => UUID.test(id));
  if (!ids.length) return {};
  const rows = await db
    .select({ invoiceId: receivableSentReceipts.invoiceId, email: receivableSentReceipts.email, sentAt: receivableSentReceipts.sentAt })
    .from(receivableSentReceipts)
    .where(and(eq(receivableSentReceipts.sheetId, sheet.id), inArray(receivableSentReceipts.invoiceId, ids)));
  const map: SentMap = {};
  for (const r of rows) (map[r.invoiceId] ??= []).push({ email: r.email, sentAt: r.sentAt.toISOString() });
  return map;
}

/**
 * SYSTEM: records that these invoices went to these addresses. Only the ones received at that
 * moment are kept; open invoices may go in every email. Called after the email went out.
 */
export async function systemRecordSentReceipts(sheetId: string, invoiceIds: string[], emails: string[], kind: 'summary' | 'payment_received'): Promise<void> {
  const ids = [...new Set(invoiceIds)].filter((id) => UUID.test(id));
  const who = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!ids.length || !who.length) return;
  const received = await db
    .select({ id: receivableInvoices.id })
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.sheetId, sheetId), inArray(receivableInvoices.id, ids), eq(receivableInvoices.status, 'received')));
  if (!received.length) return;
  await db
    .insert(receivableSentReceipts)
    .values(received.flatMap((r) => who.map((email) => ({ sheetId, invoiceId: r.id, email, kind }))))
    .onConflictDoNothing();
}
