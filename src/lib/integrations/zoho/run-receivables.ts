import 'server-only';
import { connFor, systemConnectionById, systemUpdateJob } from '@/db/repositories/integrations';
import { stageTallyImport, stageTallyReceipts, systemStartZohoSheetSync } from '@/db/repositories/receivables';
import { periodLabel } from '@/lib/receivables/tally-live/map';
import { listInvoices, listPayments } from './books';
import { mapBooksInvoices, mapBooksPayments } from './books-map';
import { ZOHO_JOBS_REGISTERED } from './run-discover';

/**
 * Sync from Zoho on a receivable sheet (docs/specs/integrations/ZOHO.md): reads the period's
 * invoices or payments from the sheet's Books (or Invoice) organisation, maps them to the Tally
 * live rows and stages them in the approval panel as the person who pressed Sync. Nothing reaches
 * an invoice until someone approves.
 */
export const ZOHO_RECEIVABLES_EVENT = 'integrations/zoho.receivables-sync';

export async function queueZohoSheetSyncRun(jobId: string): Promise<'queued' | 'inline'> {
  if (ZOHO_JOBS_REGISTERED) {
    try {
      const { inngest } = await import('@/jobs/client');
      await inngest.send({ name: ZOHO_RECEIVABLES_EVENT, data: { jobId } });
      return 'queued';
    } catch (error) {
      console.warn('[zoho] inngest unavailable; running the receivables sync inline', error instanceof Error ? error.message : error);
    }
  }
  void runZohoSheetSync(jobId);
  return 'inline';
}

const fail = (jobId: string, error: string) => systemUpdateJob(jobId, { status: 'failed', error }).catch(() => undefined);

/** Runs one sync to the end. Never throws: a failure is written on the job. */
export async function runZohoSheetSync(jobId: string): Promise<void> {
  let started: Awaited<ReturnType<typeof systemStartZohoSheetSync>>;
  try {
    started = await systemStartZohoSheetSync(jobId);
  } catch {
    return;
  }
  if (!started) return;
  const { job, params, ctx } = started;
  if (!ctx) return void (await fail(jobId, 'The person who asked for this sync can no longer edit the sheet.'));
  try {
    const row = await systemConnectionById(job.connectionId);
    if (!row || row.revokedAt) return void (await fail(jobId, 'Zoho is not connected. An admin can connect it in Firm settings.'));
    const conn = connFor(row);
    const period = periodLabel(params.from, params.to);
    const fileName = `Zoho sync ${period}`;
    const company = params.app === 'invoice' ? 'Zoho Invoice' : 'Zoho Books';
    if (params.type === 'receipts') {
      const payments = await listPayments(conn, params.orgId, params.from, params.to, params.app);
      const mapped = mapBooksPayments(payments, company, period);
      const staged = await stageTallyReceipts(ctx, params.sheetId, fileName, mapped, { source: 'zoho' });
      const notes = mapped.skipped.slice(0, 50).map((s) => `${s.voucherNo || 'A payment'} (${s.partyName || 'no customer'}, ₹${s.amount}): ${s.reason}`);
      if (staged.alreadyApplied) notes.unshift(`${staged.alreadyApplied} payment(s) were already applied by an earlier sync.`);
      await systemUpdateJob(jobId, { status: 'done', stats: { vouchers: payments.length, staged: staged.staged, skipped: mapped.skipped.length, receipts: mapped.receiptVouchers, notes, batchId: staged.batchId } });
      return;
    }
    const invoices = await listInvoices(conn, params.orgId, params.from, params.to, params.app);
    const mapped = mapBooksInvoices(invoices, company, period);
    let staged = 0;
    let batchId: string | null = null;
    if (mapped.rows.length) {
      const res = await stageTallyImport(ctx, params.sheetId, fileName, mapped, { source: 'zoho' });
      batchId = res.batchId;
      staged = res.rows.filter((r) => r.batchId === res.batchId && r.kind !== 'same').length;
    }
    await systemUpdateJob(jobId, { status: 'done', stats: { vouchers: invoices.length, staged, skipped: invoices.length - mapped.rows.length, receipts: 0, notes: mapped.warnings.slice(0, 50), batchId } });
  } catch (err) {
    console.error('[zoho] receivables sync failed', err instanceof Error ? err.message : err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    const code = (err as { code?: unknown }).code;
    const signIn = msg === 'zoho_token_unreadable' || msg === 'zoho_not_connected' || code === 'invalid_code' || code === 'invalid_grant';
    await fail(jobId, signIn ? 'Zoho needs to be connected again. An admin can do it in Firm settings > Integrations.' : `Zoho could not be read: ${msg.slice(0, 200)}. Try again, or import the Excel instead.`);
  }
}
