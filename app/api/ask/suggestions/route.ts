import { NextResponse } from 'next/server';
import { ASK_SHELLS, type AskShell } from '@/data/ask/schema';
import { shellAllowedForRole } from '@/lib/ask/access';
import { requireAsk } from '@/lib/ask/route-guard';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';
import { listSuggestions } from '@/lib/ask/suggestions';

/** GET /api/ask/suggestions?shell=&engagementId= — pre-kept questions for this viewer. */
export async function GET(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const url = new URL(request.url);
  const shell = url.searchParams.get('shell') as AskShell | null;
  if (!shell || !ASK_SHELLS.includes(shell) || !shellAllowedForRole(gate.ctx.role, shell)) {
    return NextResponse.json({ error: 'Ask VCFO is not available here' }, { status: 403 });
  }
  const engagementId = url.searchParams.get('engagementId')?.trim();
  try {
    let snapshot = null;
    if (shell === 'client') {
      if (!engagementId) return NextResponse.json({ error: 'Choose a project first' }, { status: 400 });
      const loaded = await loadProjectSnapshot(gate.ctx, engagementId);
      if (!loaded) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      snapshot = loaded.snapshot;
    }
    return NextResponse.json({ suggestions: listSuggestions(shell, snapshot), snapshot });
  } catch (error) {
    console.error('[ask-vcfo] suggestions failed', error);
    return NextResponse.json({ error: 'Could not load suggestions' }, { status: 500 });
  }
}
