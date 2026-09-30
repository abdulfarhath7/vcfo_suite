import { NextResponse } from 'next/server';
import { listClientQuestionsForGaps } from '@/db/repositories/ask-question-gaps';
import { isFirmWideAdmin } from '@/lib/auth';
import { askFeatures } from '@/lib/ask/config';
import { GAPS_WINDOW_DAYS, groupQuestions } from '@/lib/ask/question-gaps';
import { requireAsk } from '@/lib/ask/route-guard';

/**
 * GET /api/ask/admin/gaps — A1: what clients asked in the last 30 days that
 * had no reviewed topic (generated answers and hand-offs), grouped by
 * similarity. Admin / super admin; company names only for super admin.
 */
export async function GET() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!askFeatures().A1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    const since = new Date(Date.now() - GAPS_WINDOW_DAYS * 86_400_000);
    const rows = await listClientQuestionsForGaps(gate.ctx, since);
    return NextResponse.json({
      days: GAPS_WINDOW_DAYS,
      total: rows.length,
      groups: groupQuestions(rows).slice(0, 50),
      showsCompanies: gate.ctx.role === 'super_admin',
    });
  } catch (error) {
    console.error('[ask-vcfo] question gaps failed', error);
    return NextResponse.json({ error: 'Could not load question gaps' }, { status: 500 });
  }
}
