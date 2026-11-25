import { NextResponse } from 'next/server';

import { loadAssistProfile } from '@/lib/api/assist-profile';
import { gstAssistProfileResponse } from '@/lib/registrations/gst-assist';
import { GST_FORM_ID } from '@/lib/registrations/gst-profile';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/engagements/[id]/assist-profile — the VCFO Assist profile, staff only. No POST: nothing
 * writes. `?form=gst-reg-01` answers the GST REG-01 profile instead of the MCA one
 * (`src/lib/registrations/gst-profile.ts`), with signed document URLs and the readiness list.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const form = new URL(request.url).searchParams.get('form');
  if (form === GST_FORM_ID) return gstAssistProfileResponse(id);
  const loaded = await loadAssistProfile(id);
  if (loaded.ok === false) return loaded.response;
  const { schemaVersion, companyName, profile, missing, notes } = loaded.load.result;
  return NextResponse.json(
    { ok: true, schemaVersion, companyName, profile, missing, notes },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } },
  );
}
