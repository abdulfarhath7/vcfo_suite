import { NextResponse } from 'next/server';
import { stageTallyImport } from '@/db/repositories/receivables';
import { parseTallySalesRegister, TallyImportError } from '@/lib/receivables/tally-sales-register';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST /api/receivables/sheets/:id/imports — a Tally Sales Register (Excel) in the `file` field,
 * at most 5 MB. The file is parsed and staged as one pending batch for the approval panel; nothing
 * changes on the invoices until someone approves. A new upload replaces the sheet's pending batch.
 * Answers the pending rows, plus the parser's warnings.
 */
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 400 });
  let parsed;
  try {
    parsed = await parseTallySalesRegister(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof TallyImportError) return NextResponse.json({ error: e.code }, { status: 400 });
    return NextResponse.json({ error: 'not_sales_register' }, { status: 400 });
  }
  try {
    return NextResponse.json(await stageTallyImport(guard.ctx, id, file.name, parsed), { status: 201 });
  } catch (e) {
    return receivablesError(e);
  }
}
