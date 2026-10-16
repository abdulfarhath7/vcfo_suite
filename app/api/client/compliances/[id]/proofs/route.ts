import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import {
  addFilingProof,
  complianceErrorStatus,
  listFilingProofs,
} from '@/db/repositories/client-compliances';

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  const status = complianceErrorStatus(e);
  if (status == null) throw e;
  return NextResponse.json({ error: (e as Error).message }, { status });
}

/** GET /api/client/compliances/:id/proofs — the filing's proof files (rule 15). */
export async function GET(_request: Request, ctx: Ctx) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ proofs: await listFilingProofs(guard.ctx, id) });
  } catch (e) {
    return fail(e);
  }
}

/** POST multipart `file` (+ `kind`) — staff upload of an acknowledgement / challan / certificate. */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await ctx.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'file_required' }, { status: 400 });
  try {
    const proof = await addFilingProof(
      guard.ctx,
      id,
      { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
      String(form?.get('kind') ?? 'acknowledgement'),
    );
    return NextResponse.json({ proof }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
