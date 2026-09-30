import { NextResponse } from 'next/server';
import { z } from 'zod';
import { answerEnvelopeSchema } from '@/data/ask/schema';
import { getAskMessage } from '@/db/repositories/ask-messages';
import { listLibraryItems, saveLibraryItem } from '@/db/repositories/client-library';
import { toLibraryView } from '@/lib/ask/library';
import { requireAsk } from '@/lib/ask/route-guard';
import { getTopic } from '@/lib/ask/topics';

/** GET /api/ask/library — the caller's saved explanations (private). */
export async function GET() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  try {
    const rows = await listLibraryItems(gate.ctx);
    return NextResponse.json({ items: rows.map((row) => toLibraryView(row, { current: false, snapshot: null })) });
  } catch (error) {
    console.error('[ask-vcfo] library list failed', error);
    return NextResponse.json({ error: 'Could not load your library' }, { status: 500 });
  }
}

const saveSchema = z.object({
  engagementId: z.string().trim().min(1),
  topicSlug: z.string().trim().min(1).optional(),
  messageId: z.string().uuid().optional(),
  answer: answerEnvelopeSchema.optional(),
});

/**
 * POST /api/ask/library — save an answer. Content is re-derived on the
 * server: a topic save stores the current topic version, a generated answer
 * is read back from the caller's own message — the browser's copy is never
 * trusted as the saved content.
 */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role !== 'client') {
    return NextResponse.json({ error: 'Saving is only available to clients' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { engagementId, topicSlug, messageId, answer } = parsed.data;

  try {
    let input: Parameters<typeof saveLibraryItem>[1] | null = null;
    if (topicSlug) {
      const topic = getTopic(topicSlug);
      if (!topic || !answer) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      input = {
        engagementId,
        title: topic.title,
        category: topic.category,
        topicSlug: topic.slug,
        topicVersion: topic.version,
        // Keep the depth and "you are here" the client was looking at.
        answer: { ...answer, topicSlug: topic.slug, topicVersion: topic.version },
      };
    } else if (messageId) {
      const message = await getAskMessage(gate.ctx, messageId);
      const stored = answerEnvelopeSchema.safeParse(message?.answer);
      if (!message || !stored.success) return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
      input = {
        engagementId,
        title: stored.data.title || stored.data.line.slice(0, 120),
        category: 'your-project',
        answer: stored.data,
        messageId: message.id,
      };
    }
    if (!input) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
    const row = await saveLibraryItem(gate.ctx, input);
    if (!row) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ item: toLibraryView(row, { current: false, snapshot: null }) }, { status: 201 });
  } catch (error) {
    console.error('[ask-vcfo] library save failed', error);
    return NextResponse.json({ error: 'Could not save to your library' }, { status: 500 });
  }
}
