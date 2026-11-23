import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { receivableDeposits } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DepositRow } from '@/lib/receivables/deposits';
import { logChange, money, num, scopedSheet } from './shared';

/**
 * RECEIVABLES — the sheet's security deposits table (owner, 23 Nov 2026): Client, Status, ETA for
 * closure, Total SD in INR and SD due now/post signing, kept on the Sheet tab and sent to the leaders only. Both functions go through
 * `scopedSheet`, so only a person who may edit the sheet reads or writes them.
 */

export async function listDeposits(ctx: AuthContext, sheetId: string): Promise<DepositRow[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  const rows = await db.select().from(receivableDeposits).where(eq(receivableDeposits.sheetId, sheet.id)).orderBy(asc(receivableDeposits.position), asc(receivableDeposits.createdAt));
  return rows.map((r) => ({ client: r.client, status: r.status, eta: r.eta, totalInr: num(r.amountInr), due: r.due }));
}

/** Replaces the table with `rows`, in their order. The caller has checked them (`checkDeposits`). */
export async function saveDeposits(ctx: AuthContext, sheetId: string, rows: DepositRow[]): Promise<DepositRow[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  await db.transaction(async (tx) => {
    await tx.delete(receivableDeposits).where(eq(receivableDeposits.sheetId, sheet.id));
    if (rows.length)
      await tx.insert(receivableDeposits).values(
        rows.map((r, position) => ({ sheetId: sheet.id, position, client: r.client, status: r.status, eta: r.eta, amountInr: r.totalInr === null ? null : money(r.totalInr), due: r.due, updatedBy: ctx.userId })),
      );
    await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Security deposits saved (${rows.length} row${rows.length === 1 ? '' : 's'})`, affectsPage: false }, tx);
  });
  return listDeposits(ctx, sheetId);
}
