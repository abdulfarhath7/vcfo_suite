import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { checkGstinOnGstn } from '@/lib/gstzen/notices';
import { GSTZEN_STAFF_ROLES, gstzenErrorResponse } from '@/lib/gstzen/route-errors';

const bodySchema = z.object({ engagementId: z.string().min(1).max(100) });

/**
 * POST /api/gstzen/gstin-check — "Check on GSTN" on the GST registration tracker: the GSTIN
 * validator's legal name, status and jurisdiction for the recorded GSTIN, for the person to confirm.
 * Nothing is saved here. Staff only; 503 while the GSTZen route is closed.
 */
export async function POST(request: Request) {
  const guard = await requireAnyRole(...GSTZEN_STAFF_ROLES);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ result: await checkGstinOnGstn(guard.ctx, body.data.engagementId) });
  } catch (err) {
    return gstzenErrorResponse(err);
  }
}
