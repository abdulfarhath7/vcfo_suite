import { NextResponse } from 'next/server';
import { getAskConversationWithMessages } from '@/db/repositories/ask-conversations';
import { requireAsk } from '@/lib/ask/route-guard';

/** GET /api/ask/conversations/[id] — owner-only resume (U3). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const found = await getAskConversationWithMessages(gate.ctx, id);
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      conversation: {
        id: found.conversation.id,
        shell: found.conversation.shell,
        engagementId: found.conversation.engagementId,
      },
      messages: found.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        answer: m.answer,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[ask-vcfo] conversation read failed', error);
    return NextResponse.json({ error: 'Could not load the conversation' }, { status: 500 });
  }
}
