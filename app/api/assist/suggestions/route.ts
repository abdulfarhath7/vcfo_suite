import { NextResponse } from 'next/server';
import { ASSIST_SHELLS, type AssistShell } from '@/data/assist/schema';
import { shellAllowedForRole } from '@/lib/assist/access';
import { requireAssist } from '@/lib/assist/route-guard';
import { loadProjectSnapshot } from '@/lib/assist/snapshot';
import { listSuggestions } from '@/lib/assist/suggestions';

/** GET /api/assist/suggestions?shell=&engagementId= — pre-kept questions for this viewer. */
export async function GET(request: Request) {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  const url = new URL(request.url);
  const shell = url.searchParams.get('shell') as AssistShell | null;
  if (!shell || !ASSIST_SHELLS.includes(shell) || !shellAllowedForRole(gate.ctx.role, shell)) {
    return NextResponse.json({ error: 'Assist is not available here' }, { status: 403 });
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
    console.error('[assist] suggestions failed', error);
    return NextResponse.json({ error: 'Could not load suggestions' }, { status: 500 });
  }
}
