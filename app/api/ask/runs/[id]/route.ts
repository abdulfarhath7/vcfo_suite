import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAskRunView, RUN_ENDED } from '@/lib/ask/agent/view';
import { requireAsk } from '@/lib/ask/route-guard';

type RouteContext = { params: Promise<{ id: string }> };

/** One connection stays short, and EventSource reconnects, so a closed page or a dropped phone loses nothing. */
const STREAM_MS = 50_000;
const POLL_MS = 1_000;

/** GET: a run's progress as server-sent events, for the person who started it. */
export async function GET(request: Request, context: RouteContext) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success || !(await loadAskRunView(gate.ctx, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const until = Date.now() + STREAM_MS;
      let sent = '';
      try {
        while (Date.now() < until && !request.signal.aborted) {
          const view = await loadAskRunView(gate.ctx, id);
          if (!view) break;
          const text = JSON.stringify(view);
          if (text !== sent) {
            controller.enqueue(encoder.encode(`data: ${text}\n\n`));
            sent = text;
          }
          if (RUN_ENDED.has(view.status)) {
            controller.enqueue(encoder.encode('event: end\ndata: {}\n\n'));
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      } catch (error) {
        console.error('[ask-vcfo] run stream failed', error);
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
