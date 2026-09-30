import { NextResponse } from 'next/server';
import { dismissNudge, getAskClientPrefs, markNudgeShown } from '@/db/repositories/ask-client-prefs';
import { askFeatures } from '@/lib/ask/config';
import { buildNudge, endOfIndiaDay, shouldShowNudge } from '@/lib/ask/nudge';
import { requireAsk } from '@/lib/ask/route-guard';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';

/** GET /api/ask/nudge?engagementId= — C1: today's single nudge, or null. Marks it shown. */
export async function GET(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!askFeatures().C1 || gate.ctx.role !== 'client') return NextResponse.json({ nudge: null });
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'Choose a project first' }, { status: 400 });
  try {
    const now = new Date();
    if (!shouldShowNudge(await getAskClientPrefs(gate.ctx), now)) return NextResponse.json({ nudge: null });
    const loaded = await loadProjectSnapshot(gate.ctx, engagementId, now);
    if (!loaded) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const nudge = buildNudge(loaded.snapshot);
    if (nudge) await markNudgeShown(gate.ctx, now);
    return NextResponse.json({ nudge });
  } catch (error) {
    console.error('[ask-vcfo] nudge failed', error);
    return NextResponse.json({ nudge: null });
  }
}

/** POST /api/ask/nudge — dismiss until tomorrow. */
export async function POST() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!askFeatures().C1 || gate.ctx.role !== 'client') return NextResponse.json({ ok: true });
  try {
    await dismissNudge(gate.ctx, endOfIndiaDay(new Date()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ask-vcfo] nudge dismiss failed', error);
    return NextResponse.json({ error: 'Could not dismiss' }, { status: 500 });
  }
}
