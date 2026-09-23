import { NextResponse } from 'next/server';

import { loadAssistProfile } from '@/lib/api/assist-profile';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/engagements/[id]/assist-profile — the VCFO Assist profile, staff only. No POST: nothing writes. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const loaded = await loadAssistProfile(id);
  if (loaded.ok === false) return loaded.response;
  const { schemaVersion, companyName, profile, missing, notes } = loaded.load.result;
  return NextResponse.json(
    { ok: true, schemaVersion, companyName, profile, missing, notes },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } },
  );
}
