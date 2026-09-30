import { NextResponse } from 'next/server';
import { ANSWER_DEPTHS, type AnswerDepth } from '@/data/ask/schema';
import { requireAsk } from '@/lib/ask/route-guard';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';
import { applicabilityFromSnapshot, resolveTopicForViewer, topicToAnswer } from '@/lib/ask/topics';

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
  const depthParam = url.searchParams.get('depth') as AnswerDepth | null;
  const depth = depthParam && ANSWER_DEPTHS.includes(depthParam) ? depthParam : 'normal';
  const engagementId = url.searchParams.get('engagementId')?.trim();
  const clientPersona = gate.ctx.role === 'client' || Boolean(engagementId);
  if (gate.ctx.role === 'client' && !engagementId) {
    return NextResponse.json({ error: 'Choose a project first' }, { status: 400 });
  }
  try {
    let snapshot = null;
    if (engagementId) {
      if (gate.ctx.role === 'admin') return NextResponse.json({ error: 'Not available' }, { status: 403 });
      const loaded = await loadProjectSnapshot(gate.ctx, engagementId);
      if (!loaded) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      snapshot = loaded.snapshot;
    }
    const topic = resolveTopicForViewer(slug, applicabilityFromSnapshot(snapshot), clientPersona ? 'client' : 'staff');
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    const shell = clientPersona ? 'client' : gate.ctx.role === 'super_admin' ? 'super' : 'admin';
    return NextResponse.json({
      topic: { slug: topic.slug, title: topic.title, category: topic.category, version: topic.version },
      answer: topicToAnswer(topic, { depth, shell, snapshot }),
    });
  } catch (error) {
    console.error('[ask-vcfo] topic failed', error);
    return NextResponse.json({ error: 'Could not load this explanation' }, { status: 500 });
  }
}
