import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { assistSetUp } from '@/lib/assist-runs/runs';
import { hasDirectorRecord, normalizeDinResponse } from '@/lib/din-lookup/normalize';
import { DIN_REGEX } from '@/lib/din-lookup/validate';
import { capturedDirectorSchema } from '@/lib/din-lookup/capture';

/**
 * The MCA-session path of the DIN lookup (docs/context/notes/mca-lookup.md).
 *
 * MCA has no API and its master-data pages are captcha-gated against automation, so the Suite
 * never signs in to MCA and never holds an MCA password, OTP or captcha answer. Instead the
 * person signs in to MCA themselves, once, in their own browser, and the VCFO Assist extension
 * reads the page inside that session and posts the record here. This is route R1 of
 * `docs/specs/mca-connect/HANDOFF.md`, the route the firm chose, and it keeps firm policy
 * SBC-STD-AI-02 ("Agents prepare. Humans file.").
 *
 * POST   — ask for a DIN to be read from the portal. Answers the open request.
 * GET    — `?id=` one request (the page polls this), or `?pending=1` the caller's own open
 *          requests (the extension picks these up).
 * PATCH  — the extension reports back: `{ id, state: 'running' }`, `{ id, director: {...} }`
 *          when the page was read, or `{ id, state: 'failed', error }` when it was not.
 *
 * Every row belongs to the person who made it. A request is only ever read or answered from
 * that same person's signed-in Suite tab, so nobody acts on anybody else's MCA session.
 */

const dinSchema = z.string().trim().regex(DIN_REGEX, 'Invalid DIN');

const guard = () => requireAnyRole('super_admin', 'admin', 'manager', 'intern');

function notSetUp() {
  return NextResponse.json(
    {
      ok: false,
      error: 'The MCA portal path needs the VCFO Assist extension. Set VCFO_ASSIST_ENABLED to turn it on.',
      setUp: false,
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  if (!assistSetUp()) return notSetUp();

  let din: string;
  try {
    din = dinSchema.parse((await request.json())?.din);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid DIN. Expected exactly 8 digits.' }, { status: 400 });
  }

  const { openDinRequest } = await import('@/db/repositories/din-lookup');
  const req = await openDinRequest(auth.ctx, din);
  return NextResponse.json({ ok: true, setUp: true, request: req });
}

export async function GET(request: Request) {
  const auth = await guard();
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  if (!assistSetUp()) return notSetUp();

  const params = new URL(request.url).searchParams;
  const { getDinRequest, listOpenDinRequests, getCachedDinLookup } = await import('@/db/repositories/din-lookup');

  const id = params.get('id');
  if (id) {
    const req = await getDinRequest(auth.ctx, id);
    if (!req) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    // The record itself lands in the shared cache, so a finished request answers with it.
    const cached = req.state === 'done' ? await getCachedDinLookup(auth.ctx, req.din) : null;
    return NextResponse.json(
      {
        ok: true,
        setUp: true,
        request: req,
        data: cached?.data ?? null,
        source: cached?.source ?? null,
        fetchedAt: cached?.fetchedAt.toISOString() ?? null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (params.get('pending')) {
    const requests = await listOpenDinRequests(auth.ctx);
    return NextResponse.json({ ok: true, setUp: true, requests }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
}

const patchSchema = z.union([
  z.object({ id: z.string().uuid(), state: z.enum(['running', 'cancelled']) }),
  z.object({ id: z.string().uuid(), state: z.literal('failed'), error: z.string().trim().max(400) }),
  z.object({ id: z.string().uuid(), director: capturedDirectorSchema }),
]);

export async function PATCH(request: Request) {
  const auth = await guard();
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  if (!assistSetUp()) return notSetUp();

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const { getDinRequest, setDinRequestState, saveDinLookup } = await import('@/db/repositories/din-lookup');
  const req = await getDinRequest(auth.ctx, body.id);
  if (!req) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  if ('state' in body) {
    const updated = await setDinRequestState(auth.ctx, body.id, body.state, 'error' in body ? body.error : undefined);
    return NextResponse.json({ ok: true, request: updated });
  }

  // The portal capture goes through the same normaliser as the API answer, so both sources
  // reach the page in one shape.
  const data = normalizeDinResponse(body.director as Record<string, unknown>, req.din);
  if (!hasDirectorRecord(data)) {
    const updated = await setDinRequestState(auth.ctx, body.id, 'failed', 'The MCA page held no director record.');
    return NextResponse.json({ ok: false, error: 'empty_capture', request: updated }, { status: 422 });
  }
  if (data.din !== req.din) {
    const updated = await setDinRequestState(auth.ctx, body.id, 'failed', `The page read DIN ${data.din}, not ${req.din}.`);
    return NextResponse.json({ ok: false, error: 'din_mismatch', request: updated }, { status: 422 });
  }

  await saveDinLookup(auth.ctx, req.din, data, 'mca-portal');
  const updated = await setDinRequestState(auth.ctx, body.id, 'done');
  return NextResponse.json({ ok: true, request: updated, data, source: 'mca-portal' });
}
