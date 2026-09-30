import { NextResponse } from 'next/server';
import { getAssistConversationWithMessages } from '@/db/repositories/assist-conversations';
import { requireAssist } from '@/lib/assist/route-guard';

/** GET /api/assist/conversations/[id] — owner-only resume (U3). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const found = await getAssistConversationWithMessages(gate.ctx, id);
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
    console.error('[assist] conversation read failed', error);
    return NextResponse.json({ error: 'Could not load the conversation' }, { status: 500 });
  }
}
