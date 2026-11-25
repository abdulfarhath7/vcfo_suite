import { NextResponse } from 'next/server';
import { getZohoSheetSyncJob } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError } from '../../../../../_respond';

/** GET /api/receivables/sheets/:id/zoho/jobs/:jobId — one Zoho sync's progress, polled by the Sync button. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; jobId: string }> }) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id, jobId } = await context.params;
  try {
    return NextResponse.json({ job: await getZohoSheetSyncJob(guard.ctx, id, jobId) });
  } catch (e) {
    return receivablesError(e);
  }
}
