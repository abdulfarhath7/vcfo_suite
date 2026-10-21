import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getTopic, isReviewed } from '@/lib/ask/topics';

/**
 * GET /api/client/library/topic?slug= — reader side data for a published
 * client-facing topic (Library reader): review date ("Updated 6 Nov"), the steps it is
 * about ("Documents for this", "In <Company>'s project"), the related topics'
 * titles and the source links. Public firm content; no client data.
 */
const SUGGESTED = ['spice-plus-part-a', 'after-incorporation', 'gst-basics'];

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const slug = new URL(request.url).searchParams.get('slug')?.trim() ?? '';
  if (!slug) {
    // Empty Library: suggested topics (lib_empty board — SPICe+, after the COI, GST).
    const suggestions = SUGGESTED.map((s) => getTopic(s))
      .filter((t): t is NonNullable<typeof t> => !!t && t.audience !== 'staff')
      .map((t) => ({ slug: t.slug, title: t.title, question: t.question }));
    return NextResponse.json({ suggestions });
  }
  const topic = slug ? getTopic(slug) : null;
  // Same visibility as the topic itself in the reader (/api/client/library/topic/[slug]):
  // any client-facing topic; `reviewed` says whether SBC has published it.
  if (!topic || topic.audience === 'staff') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const related = topic.related
    .map((s) => getTopic(s))
    .filter((t): t is NonNullable<typeof t> => !!t && t.audience !== 'staff')
    .map((t) => ({ slug: t.slug, title: t.title, category: t.category }));
  return NextResponse.json({
    topic: {
      slug: topic.slug,
      title: topic.title,
      category: topic.category,
      reviewed: isReviewed(topic),
      reviewedAt: topic.reviewedAt ?? null,
      stepIds: topic.stepIds ?? [],
      related,
      citations: topic.citations,
      obligationId: topic.slug.startsWith('obligation-') ? topic.slug.slice('obligation-'.length) : null,
    },
  });
}
