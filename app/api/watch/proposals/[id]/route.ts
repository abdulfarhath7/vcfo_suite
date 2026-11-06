import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publicErrorMessage } from '@/lib/api-error';
import { parseJsonBody } from '@/lib/api/parse-body';
import { decideProposal } from '@/lib/watch/calendar-decision';
import { watchReviewer } from '../../_guard';

const bodySchema = z.object({ decision: z.enum(['approved', 'rejected']) });

/** POST: a manager decides a change card. Only an approval moves the calendar. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await watchReviewer();
  if (guard.ok === false) return guard.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const decided = await decideProposal(guard.ctx, id, body.data.decision);
    if (!decided) return NextResponse.json({ error: 'already_decided' }, { status: 409 });
    return NextResponse.json({ moved: decided.moved.length });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'decision_failed') }, { status: 500 });
  }
}
