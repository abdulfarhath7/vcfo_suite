import { NextResponse } from 'next/server';
import { isFirmWideAdmin } from '@/lib/auth';
import { askConfig } from '@/lib/ask/config';
import { FEED_WATCHERS } from '@/lib/ask/feeds/registry';
import { pollOfficialUpdates } from '@/lib/ask/feeds/poll';
import { requireAsk } from '@/lib/ask/route-guard';

/** Watching government sources can take a while on a slow government server. */
export const maxDuration = 300;

/** GET /api/ask/admin/feeds — the official sources Ask VCFO watches (admin / super admin). */
export async function GET() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  return NextResponse.json({
    autoPublish: askConfig().feedsAutoPublish,
    watchers: FEED_WATCHERS.map((w) => ({ id: w.id, label: w.label, act: w.act, homeUrl: w.homeUrl })),
  });
}

/**
 * POST /api/ask/admin/feeds — "Check for updates now": run every watcher once,
 * the same as the 6:30 IST job. New items are saved and sent to indexing; the
 * response says what each source listed and what was added.
 */
export async function POST() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!isFirmWideAdmin(gate.ctx.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    return NextResponse.json({ results: await pollOfficialUpdates() });
  } catch (error) {
    console.error('[ask-feeds] manual check failed', error);
    return NextResponse.json({ error: 'Could not check the official sources' }, { status: 500 });
  }
}
