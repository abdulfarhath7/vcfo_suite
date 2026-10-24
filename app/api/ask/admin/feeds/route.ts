import { NextResponse } from 'next/server';
import { isFirmWideAdmin } from '@/lib/auth';
import { FEED_WATCHERS } from '@/lib/ask/feeds/registry';
import { pollOfficialUpdates } from '@/lib/ask/feeds/poll';
import { requireAsk } from '@/lib/ask/route-guard';

/** Watching government sources can take a while on a slow government server. */
export const maxDuration = 300;

/** GET /api/ask/admin/feeds — the official sources Ask VCFO watches (staff who see the review queue: manager, admin, super admin). */
export async function GET() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role !== 'manager' && !isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  return NextResponse.json({
    watchers: FEED_WATCHERS.map((w) => ({ id: w.id, label: w.label, act: w.act, homeUrl: w.homeUrl })),
  });
}

/**
 * POST /api/ask/admin/feeds — "Check for updates now": run every watcher once,
 * the same as the 30-minute job. New items are saved and sent to indexing; the
 * response says what each source listed and what was added.
 */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    // Optional { feedIds: [...] } checks only those sources (the Sources page checks all).
    const body = (await request.json().catch(() => null)) as { feedIds?: unknown } | null;
    const feedIds = Array.isArray(body?.feedIds) ? body!.feedIds.filter((id): id is string => typeof id === 'string') : undefined;
    return NextResponse.json({ results: await pollOfficialUpdates(feedIds) });
  } catch (error) {
    console.error('[ask-feeds] manual check failed', error);
    return NextResponse.json({ error: 'Could not check the official sources' }, { status: 500 });
  }
}
