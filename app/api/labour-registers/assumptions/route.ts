import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { assumptionsInput, mergeAssumptions } from '@/lib/actions/labour/flows';

/**
 * Record how a figure was arrived at, where it was not simply read off a sheet.
 *
 * Everything here is part of every document's content address, which is the reason it lives on
 * the batch rather than in a settings table: stating that the month was fully present, or that
 * a rate of wages means a day's rather than a month's, changes what the registers say — so
 * changing it has to rebuild exactly the registers that say it, and nothing else. Keying the
 * assumptions gets that for free.
 *
 * Refused once the period is closed. An assumption that moved after the registers were built
 * would leave files that no longer match the basis recorded against them.
 *
 * POST /api/labour-registers/assumptions  { batchId, assumptions }
 */
const bodySchema = z.object({
  batchId: z.string().min(1).max(64),
  assumptions: assumptionsInput,
});

export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });

  const outcome = await mergeAssumptions(guard.ctx, body.data.batchId, body.data.assumptions);
  if (outcome.kind === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (outcome.kind === 'closed') {
    return NextResponse.json(
      { error: 'The period is closed. Reopen the inputs to change how a figure was arrived at.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ batchId: outcome.batchId, assumptions: outcome.merged });
}
