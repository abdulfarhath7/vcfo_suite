import { NextResponse } from 'next/server';
import { z } from 'zod';
import { startFill } from '@/lib/ask/fill/run';
import { clientRefused, fillRefusal } from '@/lib/ask/fill/route-errors';
import { requireAsk } from '@/lib/ask/route-guard';

const body = z.object({
  changesetId: z.string().uuid(),
  mode: z.enum(['manual', 'auto']),
  /** The chip's mode: Auto with "Watch it fill" is a browser-driven Manual run, still called Auto. */
  chip: z.enum(['manual', 'auto']).optional(),
  conversationId: z.string().uuid().optional(),
});

/** POST /api/ask/fill: "Fill into app" on a card, in Manual or Auto mode. Staff only. */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role === 'client') return clientRefused();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    return NextResponse.json(await startFill(gate.ctx, parsed.data));
  } catch (error) {
    return fillRefusal(error);
  }
}
