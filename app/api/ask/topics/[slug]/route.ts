import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { ANSWER_DEPTHS, type AnswerDepth, type AnswerEnvelope, type AskShell } from '@/data/ask/schema';
import { requireAsk } from '@/lib/ask/route-guard';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';
import { recordTopicExchange } from '@/lib/ask/topic-record';
import { applicabilityFromSnapshot, resolveTopicForViewer, topicToAnswer } from '@/lib/ask/topics';

type TopicView = { slug: string; title: string; category: string; version: number };
type Built =
  | { ok: true; topic: TopicView; answer: AnswerEnvelope; shell: AskShell; engagementDbId: string | null }
  | { ok: false; response: NextResponse };

/** The topic as an answer. GET and POST build it the same way. */
async function buildTopicAnswer(
  ctx: AuthContext,
  slug: string,
  depthParam: string | null | undefined,
  engagementParam: string | null | undefined,
): Promise<Built> {
  const depth: AnswerDepth =
    depthParam && (ANSWER_DEPTHS as readonly string[]).includes(depthParam) ? (depthParam as AnswerDepth) : 'normal';
  const engagementId = engagementParam?.trim();
  const clientPersona = ctx.role === 'client' || Boolean(engagementId);
  if (ctx.role === 'client' && !engagementId) {
    return { ok: false, response: NextResponse.json({ error: 'Choose a project first' }, { status: 400 }) };
  }
  let snapshot = null;
  let engagementDbId: string | null = null;
  if (engagementId) {
    // Only the client and the super admin (as a preview) read a project snapshot here.
    if (ctx.role !== 'client' && ctx.role !== 'super_admin') {
      return { ok: false, response: NextResponse.json({ error: 'Not available' }, { status: 403 }) };
    }
    const loaded = await loadProjectSnapshot(ctx, engagementId);
    if (!loaded) return { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
    snapshot = loaded.snapshot;
    engagementDbId = loaded.engagementDbId;
  }
  const topic = resolveTopicForViewer(slug, applicabilityFromSnapshot(snapshot), clientPersona ? 'client' : 'staff');
  if (!topic) return { ok: false, response: NextResponse.json({ error: 'Topic not found' }, { status: 404 }) };
  const shell: AskShell = clientPersona ? 'client' : ctx.role === 'super_admin' ? 'super' : 'admin';
  return {
    ok: true,
    topic: { slug: topic.slug, title: topic.title, category: topic.category, version: topic.version },
    answer: topicToAnswer(topic, { depth, shell, snapshot }),
    shell,
    engagementDbId,
  };
}

/**
 * GET /api/ask/topics/[slug]?depth=&engagementId= — a topic as an answer,
 * no model call. With an engagement (client persona) the topic follows
 * alternates and applicability, and flows show "You are here".
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { slug } = await params;
  const url = new URL(request.url);
  try {
    const built = await buildTopicAnswer(gate.ctx, slug, url.searchParams.get('depth'), url.searchParams.get('engagementId'));
    if (built.ok === false) return built.response;
    return NextResponse.json({ topic: built.topic, answer: built.answer });
  } catch (error) {
    console.error('[ask-vcfo] topic failed', error);
    return NextResponse.json({ error: 'Could not load this explanation' }, { status: 500 });
  }
}

const recordSchema = z.object({
  depth: z.string().max(20).optional(),
  engagementId: z.string().max(100).optional(),
  conversationId: z.string().uuid().optional(),
  question: z.string().max(500).optional(),
});

/**
 * POST /api/ask/topics/[slug] — the same answer as GET, then the question and
 * the answer are saved into the caller's conversation (owner item F4), so the
 * full page shows suggested-question answers. A failed save never blocks the
 * answer: the response then has no conversation id.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { slug } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  let built: Built;
  try {
    built = await buildTopicAnswer(gate.ctx, slug, parsed.data.depth, parsed.data.engagementId);
  } catch (error) {
    console.error('[ask-vcfo] topic failed', error);
    return NextResponse.json({ error: 'Could not load this explanation' }, { status: 500 });
  }
  if (built.ok === false) return built.response;

  let saved: { conversationId: string; messageId: string } | null = null;
  try {
    saved = await recordTopicExchange(gate.ctx, {
      conversationId: parsed.data.conversationId ?? null,
      shell: built.shell,
      engagementId: built.engagementDbId,
      question: parsed.data.question?.trim() || built.topic.title,
      answer: built.answer,
    });
  } catch (error) {
    console.error('[ask-vcfo] topic save failed', error);
  }
  return NextResponse.json({
    topic: built.topic,
    answer: built.answer,
    conversationId: saved?.conversationId ?? null,
    messageId: saved?.messageId ?? null,
  });
}
