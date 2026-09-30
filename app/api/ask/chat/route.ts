import { NextResponse } from 'next/server';
import { AskForbiddenError } from '@/lib/ask/access';
import { chatRequestSchema, runAskChat, type AskEvent } from '@/lib/ask/pipeline';
import { requireAsk } from '@/lib/ask/route-guard';
import { REFUSAL_COPY } from '@/lib/ask/refusals';

/**
 * POST /api/ask/chat — streams newline-delimited JSON events:
 * status labels (U2), exactly one answer, or an error.
 */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runAskChat(gate.ctx, parsed.data, emit);
      } catch (error) {
        if (error instanceof AskForbiddenError) {
          emit({ type: 'error', code: 'forbidden', message: 'Ask VCFO is not available here.' });
        } else {
          console.error('[ask-vcfo] chat failed', error);
          emit({ type: 'error', code: 'unavailable', message: REFUSAL_COPY.unavailable });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
