import { NextResponse } from 'next/server';
import { listEmailLogPage } from '@/db/repositories/receivables';
import type { EmailKind, EmailStatus } from '@/lib/receivables/v2-wire';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET /api/receivables/sheets/:id/email-log — the Email log tab (owner, 19 Nov 2026): every email
 * of the sheet, automatic and manual, newest first, 50 a page.
 * Query: origin=auto|manual, kind, status, q (subject, name or address), before (the last row's createdAt).
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const p = new URL(request.url).searchParams;
  const origin = p.get('origin');
  try {
    return NextResponse.json(
      await listEmailLogPage(guard.ctx, id, {
        origin: origin === 'auto' || origin === 'manual' ? origin : undefined,
        kind: (p.get('kind') || undefined) as EmailKind | undefined,
        status: (p.get('status') || undefined) as EmailStatus | undefined,
        q: p.get('q') ?? undefined,
        before: p.get('before'),
      }),
    );
  } catch (e) {
    return receivablesError(e);
  }
}
