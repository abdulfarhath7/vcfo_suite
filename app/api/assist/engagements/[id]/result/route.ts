import { NextResponse } from 'next/server';
import { handleAssistIngest } from '@/lib/assist-runs/ingest-route';
import { assistSetUp } from '@/lib/assist-runs/runs';
import { gstAssistResultResponse } from '@/lib/registrations/gst-assist';
import { GST_FORM_ID } from '@/lib/registrations/gst-profile';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/assist/engagements/[id]/result — the path the VCFO Assist extension already
 * posts its result to (`SUITE_API.resultPath`, `SuiteResult`). Same handler as
 * `/api/assist/engagements/[id]/runs`; a body with `srn` and no `state` closes the run as done.
 * A body with `form: 'gst-reg-01'` records the GST application's ARN, SRN or GSTIN in the
 * reg-4 tracker instead (`src/lib/registrations/gst-assist.ts`).
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let peek: unknown;
  try {
    peek = await request.clone().json();
  } catch {
    peek = null;
  }
  if (peek && typeof peek === 'object' && (peek as { form?: unknown }).form === GST_FORM_ID) {
    if (!assistSetUp()) return NextResponse.json({ ok: false, error: 'assist_not_set_up' }, { status: 503 });
    return gstAssistResultResponse(peek, id);
  }
  return handleAssistIngest(request, id);
}
