import { NextResponse } from 'next/server';
import { summaryDraft } from '@/lib/actions/receivables/summary';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET /api/receivables/sheets/:id/summary — the summary email ready to edit: subject, body in the
 * finance team's format built from the published version, the ready-made recipient lists and the
 * contacts to suggest. 409 not_published before the first Update.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    const { src: _src, ...draft } = await summaryDraft(guard.ctx, id);
    return NextResponse.json(draft);
  } catch (e) {
    return receivablesError(e);
  }
}
