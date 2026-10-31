import { NextResponse } from 'next/server';
import { ASK_SHELLS, type AskShell } from '@/data/ask/schema';
import { listOwnAskConversations } from '@/db/repositories/ask-conversations';
import { requireAsk } from '@/lib/ask/route-guard';

/**
 * GET /api/ask/conversations?shell=&engagementId=&page= — the caller's own
 * chats, newest first, 40 per page (owner item F4). `engagementId` narrows
 * to one project; with a shell and no engagement, only chats with no project.
 */
export async function GET(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const url = new URL(request.url);
  const shellParam = url.searchParams.get('shell');
  if (shellParam && !(ASK_SHELLS as readonly string[]).includes(shellParam)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const shell = (shellParam || undefined) as AskShell | undefined;
  const engagementParam = url.searchParams.get('engagementId')?.trim() || null;
  const pageParam = Number(url.searchParams.get('page') ?? '0');
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? Math.floor(pageParam) : 0;
  try {
    const { conversations, hasMore } = await listOwnAskConversations(gate.ctx, {
      shell,
      engagementId: engagementParam ?? (shell ? null : undefined),
      page,
    });
    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c.messageCount,
      })),
      hasMore,
    });
  } catch (error) {
    console.error('[ask-vcfo] conversation list failed', error);
    return NextResponse.json({ error: 'Could not load your chats' }, { status: 500 });
  }
}
