import { NextResponse } from 'next/server';
import { z } from 'zod';
import { previewSignatureRequests, sendSignatureRequests } from '@/lib/mca-filing/filing-service';
import { EmailStepSchema } from '@/lib/email/email-edits';
import { NO_STORE, assistStaff, filingError, formSchema, notFound } from '@/lib/mca-filing/route-helpers';

type RouteContext = { params: Promise<{ id: string }> };

const schema = z
  .object({ form: formSchema, signerIds: z.array(z.string().trim().min(1).max(120)).max(50).optional() })
  .merge(EmailStepSchema)
  .strict();

/**
 * POST /api/assist/engagements/[id]/filing/signature-requests — `{ preview: true }` drafts the
 * email for the "Send email" pop-up (GL-07); `{ email }`, its Send, gives each signer one email with
 * the latest portal PDF. Nothing sends this on its own. Refused until
 * the PDF is approved. Staff only; 503 while VCFO_ASSIST_ENABLED is not on.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await assistStaff();
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_body' }, { status: 400 });
  try {
    // GL-07: `preview` gives the "Send email" pop-up its draft; only its Send (`email`) sends.
    if (parsed.data.preview) {
      const draft = await previewSignatureRequests(auth.ctx, id, parsed.data.form, parsed.data.signerIds);
      if (!draft) return notFound();
      return NextResponse.json({ ok: true, draft }, { headers: NO_STORE });
    }
    if (!parsed.data.email) return NextResponse.json({ ok: false, error: 'Open the email and press Send.' }, { status: 400 });
    const out = await sendSignatureRequests(auth.ctx, id, parsed.data.form, parsed.data.signerIds, parsed.data.email);
    if (!out) return notFound();
    return NextResponse.json({ ok: true, filing: out.filing, requests: out.requests }, { headers: NO_STORE });
  } catch (e) {
    return filingError(e, 'signature requests');
  }
}
