import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { addCredentialRow, removeCredentialRow } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError, engagementParam } from '../_respond';

const sheet = z.enum(['login', 'other', 'kyc']);

/** POST /api/client/credentials/rows — Add row (Login / Other) or Add director (KYC). */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, z.object({ sheet }));
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const out = await addCredentialRow(guard.ctx, { sheet: parsed.data.sheet, engagementId: engagementParam(request) });
    return NextResponse.json({ ok: true, rowKey: out.rowKey, credentials: out.payload });
  } catch (e) {
    return credentialsError(e);
  }
}

/** DELETE /api/client/credentials/rows — Undo of an added row / director (custom rows only). */
export async function DELETE(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, z.object({ sheet, rowKey: z.string().min(1).max(120) }));
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const credentials = await removeCredentialRow(guard.ctx, { ...parsed.data, engagementId: engagementParam(request) });
    return NextResponse.json({ ok: true, credentials });
  } catch (e) {
    return credentialsError(e);
  }
}
