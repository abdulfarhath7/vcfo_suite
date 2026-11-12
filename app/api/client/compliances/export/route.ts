import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getPortalFilings } from '@/db/repositories/client-compliances';
import { parseFyParam } from '@/lib/compliance/filings';
import { standardDownloadName } from '@/lib/files/download-name';
import {
  AREAS,
  fyLabelOf,
  filingsCsv,
  statusOf,
  todayIso,
  type AreaFilter,
  type CompStatus,
} from '@/lib/client-portal/compliances';

const CADENCE: Record<string, string[]> = {
  monthly: ['monthly'],
  quarterly: ['quarterly', 'half-yearly'],
  annual: ['annual', 'one-time'],
};

/** GET /api/client/compliances/export?fy=&cadence=&area=&status=&engagement= — CSV of the Filings view (`engagement` for staff). */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const fy = parseFyParam(p.get('fy'));
  const today = todayIso();
  let rows = await getPortalFilings(guard.ctx, { fyStartYear: fy ?? undefined, engagementId: p.get('engagement') ?? undefined });
  const cadence = p.get('cadence');
  if (cadence && CADENCE[cadence]) rows = rows.filter((r) => CADENCE[cadence]!.includes(r.frequency.toLowerCase()));
  const area = p.get('area') as AreaFilter | null;
  if (area && area !== 'all' && AREAS.some((a) => a.id === area)) rows = rows.filter((r) => r.area === area);
  const status = p.get('status') as CompStatus | 'all' | null;
  if (status && status !== 'all' && ['ok', 'due', 'over', 'up'].includes(status)) rows = rows.filter((r) => statusOf(r, today) === status);
  // GL-08: `Filings-<FY>[-<cadence>]_<Client>_<DD-MM-YYYY>.csv`; the client name only when every row is one company.
    const companies = new Set(rows.map((r) => r.companyName));
    const name = standardDownloadName(`Filings ${fy ? fyLabelOf(fy) : 'All'}${cadence ? ` ${cadence}` : ''}`, companies.size === 1 ? [...companies][0] : null, 'csv');
  return new Response('﻿' + filingsCsv(rows, today), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}
