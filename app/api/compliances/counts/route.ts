import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getComplianceCounts } from '@/db/repositories/compliance-counts';
import { complianceError } from '../_respond';

/**
 * GET /api/compliances/counts?engagementId=&from=&to= — totals for the category switch on
 * Obligations, Calendar and Filings (all, statutory, non-statutory). Default range: the current FY.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const date = (name: string) => {
    const v = p.get(name);
    return v && DATE.test(v) ? v : null;
  };
  try {
    return NextResponse.json(await getComplianceCounts(guard.ctx, { engagementId: p.get('engagementId'), from: date('from'), to: date('to') }));
  } catch (e) {
    return complianceError(e);
  }
}
