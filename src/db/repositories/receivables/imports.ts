import 'server-only';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, receivableClients, receivableImportBatches, receivableImportRows, receivableInvoices } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { addDaysIso, monthStart } from '@/lib/receivables/dates';
import { clientKey } from '@/lib/receivables/client-key';
import { voucherKey, type TallySalesRegister } from '@/lib/receivables/tally-sales-register';
import type { ApproveEdit, ImportBatchDto, ImportRowDto, ImportRowKind, PendingImportsDto } from '@/lib/receivables/v2-wire';
import { cleanCreditDays, findOrCreateClient, sheetPartnerId, type ClientRow } from './clients';
import { ISO_DATE, UUID, conflict, invalid, invoiceLabel, logChange, money, notFound, num, scopedInvoice, scopedSheet, type InvoiceRow } from './shared';

/**
 * RECEIVABLES v2 — the Tally import and the approval panel (docs/specs/receivables/V2.md).
 *
 * An upload is staged as one batch of rows; nothing touches the invoices until someone approves.
 * A staff amount change is a row with no batch. Approval, from either source, happens in
 * `approveImportRows`. Every function goes through `scopedSheet` (or `scopedInvoice`).
 *
 * Matching: invoices have no unique key on `invoice_no`, so a row matches a live invoice of the
 * sheet by `voucherKey` (leading zeros dropped in each number), the same way
 * scripts/provision-summit-receivables.ts dedupes by invoice number. A row with no such match then
 * tries the invoices that have no number yet (loaded from the weekly workbook): the same client
 * (`client_key`) and the same amount within one rupee, the earliest due date first. That row is
 * MATCHED, and approving it fills in the invoice number, date and GSTIN from Tally.
 */

/** Amounts within this many rupees count as the same invoice when matching by client and amount. */
const AMOUNT_MATCH_TOLERANCE = 1;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ImportRow = typeof receivableImportRows.$inferSelect;

/** What approval hands to the email job: the new invoices and the amount changes. */
export type ApprovalOutcome = {
  approved: number;
  invoiceIds: string[];
  newInvoiceIds: string[];
  revised: Array<{ invoiceId: string; oldAmountInr: number; newAmountInr: number; reason: string | null }>;
  refused: Array<{ rowId: string; code: string }>;
};

const sameMoney = (a: number | null, b: number | null) => a !== null && b !== null && Math.round(a * 100) === Math.round(b * 100);

/** A received or part-paid invoice keeps its amount until the payment is reopened. */
function paidLocked(inv: Pick<InvoiceRow, 'status' | 'partPaid'>): boolean {
  return inv.status !== 'open' || (num(inv.partPaid) ?? 0) > 0;
}

/** The sheet's live invoices by voucher key (only rows with an invoice number can match). */
async function invoicesByKey(tx: Tx | typeof db, sheetId: string): Promise<Map<string, InvoiceRow>> {
  const rows = await tx
    .select()
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.sheetId, sheetId), isNull(receivableInvoices.deletedAt)));
  const map = new Map<string, InvoiceRow>();
  for (const r of rows) if (r.invoiceNo) map.set(voucherKey(r.invoiceNo), r);
  return map;
}

/** The sheet's live invoices with no invoice number yet, for matching by client and amount. */
async function unnumberedInvoices(tx: Tx | typeof db, sheetId: string): Promise<InvoiceRow[]> {
  const rows = await tx
    .select()
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.sheetId, sheetId), isNull(receivableInvoices.deletedAt), isNull(receivableInvoices.invoiceNo)));
  return rows.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

/**
 * The first unnumbered invoice of this client whose amount is within a rupee of `amount`, not yet
 * claimed by another row of the same upload. The client is the same when the invoice's client
 * record is, or when the two names have the same `clientKey`.
 */
function claimByAmount(pool: InvoiceRow[], claimed: Set<string>, key: string, clientId: string, amount: number): InvoiceRow | undefined {
  const hit = pool.find(
    (inv) =>
      !claimed.has(inv.id) &&
      (inv.clientId === clientId || clientKey(inv.clientName) === key) &&
      Math.abs((num(inv.amountInr) ?? 0) + (num(inv.partPaid) ?? 0) - amount) <= AMOUNT_MATCH_TOLERANCE,
  );
  if (hit) claimed.add(hit.id);
  return hit;
}

/** Closes a batch once nothing but SAME rows waits in it: the SAME rows are skipped then. */
async function closeBatchIfDone(tx: Tx, batchId: string | null): Promise<void> {
  if (!batchId) return;
  const open = await tx
    .select({ id: receivableImportRows.id })
    .from(receivableImportRows)
    .where(and(eq(receivableImportRows.batchId, batchId), eq(receivableImportRows.status, 'pending'), ne(receivableImportRows.kind, 'same')))
    .limit(1);
  if (open.length) return;
  const now = new Date();
  await tx
    .update(receivableImportRows)
    .set({ status: 'skipped', decidedAt: now })
    .where(and(eq(receivableImportRows.batchId, batchId), eq(receivableImportRows.status, 'pending')));
  const approved = await tx
    .select({ id: receivableImportRows.id })
    .from(receivableImportRows)
    .where(and(eq(receivableImportRows.batchId, batchId), eq(receivableImportRows.status, 'approved')))
    .limit(1);
  await tx
    .update(receivableImportBatches)
    .set({ status: approved.length ? 'approved' : 'discarded', updatedAt: now })
    .where(and(eq(receivableImportBatches.id, batchId), eq(receivableImportBatches.status, 'pending')));
}

/**
 * Stages one Tally Sales Register upload as a pending batch. A sheet has one pending batch at a
 * time, so an earlier pending batch is discarded first. For each row: the client is found by its
 * key (or created with no partner and 7 credit days); the invoice is matched by voucher key; the
 * due date is the invoice date plus the client's credit days.
 *  - no match → `new` (or `no_partner` when the client has no partner yet);
 *  - a match whose amount differs → `changed`;
 *  - a match whose amount is equal → `same`, which also clears the invoice's "Fix in Tally" flag.
 */
export async function stageTallyImport(ctx: AuthContext, sheetId: string, fileName: string, parsed: TallySalesRegister): Promise<PendingImportsDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const name = fileName.trim().slice(0, 200) || 'Sales Register.xlsx';
  await db.transaction(async (tx) => {
    const now = new Date();
    const old = await tx
      .select({ id: receivableImportBatches.id })
      .from(receivableImportBatches)
      .where(and(eq(receivableImportBatches.sheetId, sheet.id), eq(receivableImportBatches.status, 'pending')));
    if (old.length) {
      const ids = old.map((b) => b.id);
      await tx.update(receivableImportRows).set({ status: 'skipped', decidedAt: now }).where(and(inArray(receivableImportRows.batchId, ids), eq(receivableImportRows.status, 'pending')));
      await tx.update(receivableImportBatches).set({ status: 'discarded', updatedAt: now }).where(inArray(receivableImportBatches.id, ids));
    }
    const [batch] = await tx
      .insert(receivableImportBatches)
      .values({ sheetId: sheet.id, fileName: name, company: parsed.company.slice(0, 200), period: parsed.period.slice(0, 60), uploadedBy: ctx.userId })
      .returning();

    const byKey = await invoicesByKey(tx, sheet.id);
    const unnumbered = await unnumberedInvoices(tx, sheet.id);
    const claimed = new Set<string>();
    const clients = new Map<string, ClientRow>();
    const counts: Record<ImportRowKind, number> = { new: 0, changed: 0, same: 0, no_partner: 0, matched: 0 };
    const values: Array<typeof receivableImportRows.$inferInsert> = [];
    for (const r of parsed.rows) {
      const cacheKey = r.clientName.toLowerCase();
      let client = clients.get(cacheKey);
      if (!client) {
        client = await findOrCreateClient(tx, sheet.id, r.clientName, r.gstin);
        clients.set(cacheKey, client);
      }
      let match = byKey.get(r.invoiceKey);
      let kind: ImportRowKind;
      // No invoice with this number: try an unnumbered invoice of the same client and amount.
      const byAmount = match ? undefined : claimByAmount(unnumbered, claimed, clientKey(r.clientName), client.id, r.amountInr);
      if (byAmount) {
        match = byAmount;
        kind = 'matched';
      } else if (match) {
        const same = sameMoney(num(match.amountInr), r.amountInr);
        kind = same ? 'same' : 'changed';
        // A SAME row is the Tally books agreeing with the sheet: the "Fix in Tally" flag goes, and an
        // invoice made before v2 is linked to its client.
        if (same && (match.tallyMismatch || !match.clientId)) {
          await tx.update(receivableInvoices).set({ tallyMismatch: false, clientId: match.clientId ?? client.id }).where(eq(receivableInvoices.id, match.id));
        }
      } else {
        kind = client.partnerId ? 'new' : 'no_partner';
      }
      counts[kind] += 1;
      values.push({
        batchId: batch.id,
        sheetId: sheet.id,
        kind,
        invoiceId: match?.id ?? null,
        invoiceNo: r.invoiceNo,
        invoiceKey: r.invoiceKey,
        invoiceDate: r.invoiceDate,
        clientName: client.name,
        clientId: client.id,
        partnerId: match ? match.partnerId : client.partnerId,
        gstin: r.gstin,
        amountInr: money(r.amountInr),
        oldAmountInr: match ? money(num(match.amountInr) ?? 0) : null,
        dueDate: match ? String(match.dueDate) : addDaysIso(r.invoiceDate, client.creditDays),
        source: 'tally',
        requestedBy: ctx.userId,
      });
    }
    for (let i = 0; i < values.length; i += 200) await tx.insert(receivableImportRows).values(values.slice(i, i + 200));
    await tx
      .update(receivableImportBatches)
      // MATCHED rows have no column of their own; they are counted with SAME here and shown apart from the rows.
      .set({ rowCount: values.length, newCount: counts.new, changedCount: counts.changed, sameCount: counts.same + counts.matched, noPartnerCount: counts.no_partner, updatedAt: now })
      .where(eq(receivableImportBatches.id, batch.id));
    await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Tally Sales Register ${name} uploaded: ${values.length} rows waiting for approval`, affectsPage: false }, tx);
  });
  return { ...(await getPendingImports(ctx, sheet.id)), warnings: parsed.warnings };
}

/** The approval panel: the pending batch, if any, and every pending row (Tally and staff). */
export async function getPendingImports(ctx: AuthContext, sheetId: string): Promise<PendingImportsDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const [batches, rows] = await Promise.all([
    db
      .select({ batch: receivableImportBatches, uploadedByName: profiles.name })
      .from(receivableImportBatches)
      .leftJoin(profiles, eq(profiles.id, receivableImportBatches.uploadedBy))
      .where(and(eq(receivableImportBatches.sheetId, sheet.id), eq(receivableImportBatches.status, 'pending')))
      .limit(1),
    db
      .select({ row: receivableImportRows, creditDays: receivableClients.creditDays, requestedByName: profiles.name })
      .from(receivableImportRows)
      .leftJoin(receivableClients, eq(receivableClients.id, receivableImportRows.clientId))
      .leftJoin(profiles, eq(profiles.id, receivableImportRows.requestedBy))
      .where(and(eq(receivableImportRows.sheetId, sheet.id), eq(receivableImportRows.status, 'pending')))
      .orderBy(asc(receivableImportRows.clientName), asc(receivableImportRows.invoiceDate)),
  ]);
  const b = batches[0];
  const batch: ImportBatchDto | null = b
    ? {
        id: b.batch.id,
        fileName: b.batch.fileName,
        company: b.batch.company,
        period: b.batch.period,
        uploadedByName: b.uploadedByName ?? null,
        createdAt: b.batch.createdAt.toISOString(),
        rowCount: b.batch.rowCount,
        newCount: b.batch.newCount,
        changedCount: b.batch.changedCount,
        sameCount: b.batch.sameCount,
        noPartnerCount: b.batch.noPartnerCount,
        matchedCount: rows.filter((r) => r.row.kind === 'matched' && r.row.batchId === b.batch.id).length,
      }
    : null;
  return {
    batch,
    rows: rows.map(({ row, creditDays, requestedByName }) => toRowDto(row, creditDays ?? 7, requestedByName ?? null)),
  };
}

function toRowDto(row: ImportRow, creditDays: number, requestedByName: string | null): ImportRowDto {
  return {
    id: row.id,
    batchId: row.batchId,
    kind: row.kind as ImportRowKind,
    source: row.source === 'staff' ? 'staff' : 'tally',
    invoiceId: row.invoiceId,
    invoiceNo: row.invoiceNo,
    invoiceDate: row.invoiceDate ? String(row.invoiceDate) : null,
    clientName: row.clientName,
    clientId: row.clientId,
    partnerId: row.partnerId,
    gstin: row.gstin,
    amountInr: num(row.amountInr) ?? 0,
    oldAmountInr: num(row.oldAmountInr),
    dueDate: row.dueDate ? String(row.dueDate) : null,
    creditDays,
    reason: row.reason,
    requestedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length > 2000) throw invalid('rows');
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && UUID.test(id)))];
}

/**
 * Approves pending rows, in one transaction:
 *  - NEW (and NO PARTNER once a partner is picked) rows become open invoices from Tally, with the
 *    client, its partner, the invoice date and month, and the due date as edited;
 *  - CHANGED rows set the invoice's amount, add one to its revision and log the before and after
 *    (a staff change also flags "Fix in Tally"); a received or part-paid invoice refuses with
 *    `paid_locked` and its row stays pending;
 *  - SAME rows are skipped;
 *  - edited credit days and a partner picked for a client are saved on the client.
 * Rows refused for a reason are listed in `refused`; the rest are approved.
 */
export async function approveImportRows(ctx: AuthContext, sheetId: string, rowIds: string[], edits: ApproveEdit[] = []): Promise<ApprovalOutcome> {
  const sheet = await scopedSheet(ctx, sheetId);
  const ids = cleanIds(rowIds);
  const outcome: ApprovalOutcome = { approved: 0, invoiceIds: [], newInvoiceIds: [], revised: [], refused: [] };
  if (!ids.length) return outcome;
  const editOf = new Map<string, ApproveEdit>();
  for (const e of edits ?? []) if (e && typeof e.rowId === 'string') editOf.set(e.rowId, e);

  await db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .select()
      .from(receivableImportRows)
      .where(and(eq(receivableImportRows.sheetId, sheet.id), eq(receivableImportRows.status, 'pending'), inArray(receivableImportRows.id, ids)));
    const clientIds = [...new Set(rows.map((r) => r.clientId).filter((id): id is string => Boolean(id)))];
    const clientRows = clientIds.length ? await tx.select().from(receivableClients).where(inArray(receivableClients.id, clientIds)) : [];
    const clients = new Map(clientRows.map((c) => [c.id, c]));
    const byKey = await invoicesByKey(tx, sheet.id);
    const batchFiles = new Map<string, number>();

    // Client edits first (credit days, the partner of a client with none), so every row of that client sees them.
    for (const r of rows) {
      const e = editOf.get(r.id);
      const client = r.clientId ? clients.get(r.clientId) : undefined;
      if (!e || !client) continue;
      const set: Partial<typeof receivableClients.$inferInsert> = {};
      if (e.creditDays !== undefined && e.creditDays !== null && cleanCreditDays(e.creditDays) !== client.creditDays) set.creditDays = cleanCreditDays(e.creditDays);
      if (e.partnerId && e.partnerId !== client.partnerId) {
        set.partnerId = await sheetPartnerId(sheet.id, e.partnerId, tx);
      }
      if (Object.keys(set).length) {
        const [updated] = await tx.update(receivableClients).set({ ...set, updatedAt: now }).where(eq(receivableClients.id, client.id)).returning();
        clients.set(client.id, updated);
        if (set.partnerId) {
          await tx
            .update(receivableInvoices)
            .set({ partnerId: set.partnerId, updatedAt: now })
            .where(and(eq(receivableInvoices.clientId, client.id), isNull(receivableInvoices.deletedAt)));
        }
      }
    }

    const decided: string[] = [];
    const skipped: string[] = [];
    for (const r of rows) {
      const e = editOf.get(r.id);
      const client = r.clientId ? clients.get(r.clientId) : undefined;
      if (r.kind === 'same') {
        skipped.push(r.id);
        continue;
      }
      if (r.kind === 'matched') {
        // Fill in what Tally knows about an invoice the workbook loaded without a number.
        const [inv] = r.invoiceId
          ? await tx
              .select()
              .from(receivableInvoices)
              .where(and(eq(receivableInvoices.id, r.invoiceId), eq(receivableInvoices.sheetId, sheet.id), isNull(receivableInvoices.deletedAt)))
              .limit(1)
          : [];
        if (!inv) {
          outcome.refused.push({ rowId: r.id, code: 'not_found' });
          continue;
        }
        if (inv.invoiceNo && r.invoiceKey && voucherKey(inv.invoiceNo) !== r.invoiceKey) {
          outcome.refused.push({ rowId: r.id, code: 'already_exists' });
          continue;
        }
        const dueDate = e?.dueDate && ISO_DATE.test(e.dueDate) ? e.dueDate : null;
        const [row] = await tx
          .update(receivableInvoices)
          .set({
            invoiceNo: r.invoiceNo,
            invoiceDate: inv.invoiceDate ?? (r.invoiceDate ? String(r.invoiceDate) : null),
            gstin: inv.gstin ?? r.gstin,
            clientId: inv.clientId ?? r.clientId,
            tallyMismatch: false,
            ...(dueDate ? { dueDate } : {}),
            updatedAt: now,
          })
          .where(eq(receivableInvoices.id, inv.id))
          .returning();
        await logChange(
          { sheetId: sheet.id, invoiceId: inv.id, actorId: ctx.userId, summary: `${invoiceLabel(row)} matched to Tally by client and amount`, field: 'invoiceNo', before: inv.invoiceNo, after: r.invoiceNo },
          tx,
        );
        if (r.invoiceKey) byKey.set(r.invoiceKey, row);
        outcome.invoiceIds.push(inv.id);
        decided.push(r.id);
        continue;
      }
      if (r.kind === 'new' || r.kind === 'no_partner') {
        const partnerId = client?.partnerId ?? null;
        if (!partnerId) {
          outcome.refused.push({ rowId: r.id, code: 'no_partner' });
          continue;
        }
        if (r.invoiceKey && byKey.has(r.invoiceKey)) {
          outcome.refused.push({ rowId: r.id, code: 'already_exists' });
          continue;
        }
        const invoiceDate = r.invoiceDate ? String(r.invoiceDate) : null;
        if (!invoiceDate) {
          outcome.refused.push({ rowId: r.id, code: 'invoice_date' });
          continue;
        }
        let dueDate = r.dueDate ? String(r.dueDate) : addDaysIso(invoiceDate, client?.creditDays ?? 7);
        if (e?.dueDate) {
          if (!ISO_DATE.test(e.dueDate) || Number.isNaN(Date.parse(`${e.dueDate}T00:00:00Z`))) {
            outcome.refused.push({ rowId: r.id, code: 'due_date' });
            continue;
          }
          dueDate = e.dueDate;
        } else if (e?.creditDays !== undefined) {
          dueDate = addDaysIso(invoiceDate, client?.creditDays ?? 7);
        }
        const [inv] = await tx
          .insert(receivableInvoices)
          .values({
            sheetId: sheet.id,
            clientName: client?.name ?? r.clientName,
            clientId: client?.id ?? null,
            invoiceNo: r.invoiceNo,
            invoiceMonth: monthStart(invoiceDate),
            invoiceDate,
            dueDate,
            amountInr: r.amountInr,
            currency: 'INR',
            partnerId,
            gstin: r.gstin,
            source: 'tally',
            createdBy: ctx.userId,
          })
          .returning();
        if (r.invoiceKey) byKey.set(r.invoiceKey, inv);
        outcome.newInvoiceIds.push(inv.id);
        outcome.invoiceIds.push(inv.id);
        decided.push(r.id);
        if (r.batchId) batchFiles.set(r.batchId, (batchFiles.get(r.batchId) ?? 0) + 1);
        continue;
      }
      // CHANGED, from Tally or from staff.
      if (!r.invoiceId) {
        outcome.refused.push({ rowId: r.id, code: 'not_found' });
        continue;
      }
      const [inv] = await tx
        .select()
        .from(receivableInvoices)
        .where(and(eq(receivableInvoices.id, r.invoiceId), eq(receivableInvoices.sheetId, sheet.id), isNull(receivableInvoices.deletedAt)))
        .limit(1);
      if (!inv) {
        outcome.refused.push({ rowId: r.id, code: 'not_found' });
        continue;
      }
      if (paidLocked(inv)) {
        outcome.refused.push({ rowId: r.id, code: 'paid_locked' });
        continue;
      }
      const before = num(inv.amountInr) ?? 0;
      const after = num(r.amountInr) ?? 0;
      const revision = inv.revision + 1;
      const dueDate = e?.dueDate && ISO_DATE.test(e.dueDate) ? e.dueDate : null;
      const [row] = await tx
        .update(receivableInvoices)
        .set({
          amountInr: money(after),
          revision,
          // A staff change is not in the Tally books yet; a later upload with the same amount clears this.
          tallyMismatch: r.source === 'staff',
          clientId: inv.clientId ?? r.clientId,
          ...(dueDate ? { dueDate } : {}),
          updatedAt: now,
        })
        .where(eq(receivableInvoices.id, inv.id))
        .returning();
      const why = r.reason ? `: ${r.reason}` : r.source === 'tally' ? ' (from Tally)' : '';
      await logChange(
        { sheetId: sheet.id, invoiceId: inv.id, actorId: ctx.userId, summary: `${invoiceLabel(row)} amount revised (r${revision})${why}`, field: 'amountInr', before: money(before), after: money(after) },
        tx,
      );
      if (dueDate && dueDate !== String(inv.dueDate)) {
        await logChange({ sheetId: sheet.id, invoiceId: inv.id, actorId: ctx.userId, summary: `${invoiceLabel(row)} due date edited`, field: 'dueDate', before: String(inv.dueDate), after: dueDate }, tx);
      }
      outcome.revised.push({ invoiceId: inv.id, oldAmountInr: before, newAmountInr: after, reason: r.reason });
      outcome.invoiceIds.push(inv.id);
      decided.push(r.id);
    }

    if (decided.length) {
      await tx.update(receivableImportRows).set({ status: 'approved', decidedBy: ctx.userId, decidedAt: now }).where(inArray(receivableImportRows.id, decided));
    }
    if (skipped.length) {
      await tx.update(receivableImportRows).set({ status: 'skipped', decidedBy: ctx.userId, decidedAt: now }).where(inArray(receivableImportRows.id, skipped));
    }
    outcome.approved = decided.length;

    for (const [batchId, n] of batchFiles) {
      const [b] = await tx.select({ fileName: receivableImportBatches.fileName }).from(receivableImportBatches).where(eq(receivableImportBatches.id, batchId)).limit(1);
      await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `${n} invoice${n === 1 ? '' : 's'} imported from Tally (${b?.fileName ?? 'Sales Register'})` }, tx);
    }
    for (const batchId of new Set(rows.map((r) => r.batchId))) await closeBatchIfDone(tx, batchId);
  });
  return outcome;
}

/** Rejects pending rows; nothing changes on the invoices. */
export async function rejectImportRows(ctx: AuthContext, sheetId: string, rowIds: string[]): Promise<{ rejected: number }> {
  const sheet = await scopedSheet(ctx, sheetId);
  const ids = cleanIds(rowIds);
  if (!ids.length) return { rejected: 0 };
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(receivableImportRows)
      .set({ status: 'rejected', decidedBy: ctx.userId, decidedAt: new Date() })
      .where(and(eq(receivableImportRows.sheetId, sheet.id), eq(receivableImportRows.status, 'pending'), inArray(receivableImportRows.id, ids)))
      .returning({ id: receivableImportRows.id, batchId: receivableImportRows.batchId, source: receivableImportRows.source, invoiceId: receivableImportRows.invoiceId });
    for (const r of rows.filter((x) => x.source === 'staff' && x.invoiceId)) {
      await logChange({ sheetId: sheet.id, invoiceId: r.invoiceId, actorId: ctx.userId, summary: 'Amount change rejected', affectsPage: false }, tx);
    }
    for (const batchId of new Set(rows.map((r) => r.batchId))) await closeBatchIfDone(tx, batchId);
    return { rejected: rows.length };
  });
}

/** Discards a pending upload: its pending rows are skipped and the batch is closed. */
export async function discardBatch(ctx: AuthContext, sheetId: string, batchId: string): Promise<void> {
  const sheet = await scopedSheet(ctx, sheetId);
  if (!UUID.test(batchId ?? '')) throw notFound();
  await db.transaction(async (tx) => {
    const [batch] = await tx
      .update(receivableImportBatches)
      .set({ status: 'discarded', updatedAt: new Date() })
      .where(and(eq(receivableImportBatches.id, batchId), eq(receivableImportBatches.sheetId, sheet.id), eq(receivableImportBatches.status, 'pending')))
      .returning();
    if (!batch) throw notFound();
    await tx
      .update(receivableImportRows)
      .set({ status: 'skipped', decidedBy: ctx.userId, decidedAt: new Date() })
      .where(and(eq(receivableImportRows.batchId, batch.id), eq(receivableImportRows.status, 'pending')));
    await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Tally upload ${batch.fileName} discarded`, affectsPage: false }, tx);
  });
}

/**
 * Phase 3: a staff amount change ("Change amount" on a sheet row), for example from a client
 * partner's email. It waits in the approval panel like a CHANGED row from Tally. A received or
 * part-paid invoice refuses with `paid_locked`.
 */
export async function requestAmountChange(ctx: AuthContext, invoiceId: string, input: { amountInr: unknown; reason: unknown }): Promise<ImportRowDto> {
  const { invoice, sheet } = await scopedInvoice(ctx, invoiceId);
  if (paidLocked(invoice)) throw conflict('paid_locked');
  const amount = Number(input.amountInr);
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e12) throw invalid('amount');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > 300) throw invalid('reason');
  const before = num(invoice.amountInr) ?? 0;
  if (sameMoney(before, amount)) throw invalid('same_amount');
  const [client] = invoice.clientId ? await db.select().from(receivableClients).where(eq(receivableClients.id, invoice.clientId)).limit(1) : [];
  const [row] = await db
    .insert(receivableImportRows)
    .values({
      batchId: null,
      sheetId: sheet.id,
      kind: 'changed',
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceKey: invoice.invoiceNo ? voucherKey(invoice.invoiceNo) : null,
      invoiceDate: invoice.invoiceDate ? String(invoice.invoiceDate) : null,
      clientName: invoice.clientName,
      clientId: invoice.clientId,
      partnerId: invoice.partnerId,
      gstin: invoice.gstin,
      amountInr: money(amount),
      oldAmountInr: money(before),
      dueDate: String(invoice.dueDate),
      reason,
      source: 'staff',
      requestedBy: ctx.userId,
    })
    .returning();
  await logChange({ sheetId: sheet.id, invoiceId: invoice.id, actorId: ctx.userId, summary: `${invoiceLabel(invoice)} amount change to ₹${money(amount)} requested: ${reason}`, affectsPage: false });
  return toRowDto(row, client?.creditDays ?? 7, null);
}
