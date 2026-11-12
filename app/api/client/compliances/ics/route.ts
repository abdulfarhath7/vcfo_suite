import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getPortalFilings } from '@/db/repositories/client-compliances';
import { parseFyParam } from '@/lib/compliance/filings';
import { standardDownloadName } from '@/lib/files/download-name';
import { filingsIcs, fyLabelOf } from '@/lib/client-portal/compliances';

/** GET /api/client/compliances/ics?fy=2026 — every unfiled deadline of the FY as one .ics. */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const fy = parseFyParam(new URL(request.url).searchParams.get('fy'));
  const rows = (await getPortalFilings(guard.ctx, { fyStartYear: fy ?? undefined })).filter((r) => !r.filedOn);
  const companies = new Set(rows.map((r) => r.companyName));
  const file = standardDownloadName(`Compliances ${fy ? fyLabelOf(fy) : 'All'}`, companies.size === 1 ? [...companies][0] : null, 'ics');
  return new Response(filingsIcs(rows), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'no-store',
    },
  });
}
