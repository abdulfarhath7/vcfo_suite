import { NextResponse } from 'next/server';
import { discardBatch } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError } from '../../../../_respond';

/** DELETE /api/receivables/sheets/:id/imports/:batchId — discards a pending Tally upload. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; batchId: string }> }) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id, batchId } = await context.params;
  try {
    await discardBatch(guard.ctx, id, batchId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
