import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { gstReadinessView } from '@/lib/registrations/gst-readiness';
import { askClientForGst, fetchGstFromSharepoint, loadGstReadiness } from '@/lib/registrations/gst-sourcing';

type RouteContext = { params: Promise<{ id: string }> };

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

/**
 * GET /api/engagements/[id]/gst-registration — the GST REG-01 readiness for the reg-4 page: what
 * the tool holds, what is missing and where it comes from. Staff only (the Assist profile's
 * access rule). No document URLs here; the extension reads those from the assist-profile route.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const loaded = await loadGstReadiness(auth.ctx, id);
  if (loaded.ok === false) return NextResponse.json({ ok: false, error: loaded.error }, { status: loaded.status });
  const view = gstReadinessView(loaded.result, { zohoLinked: loaded.zoho.linked });
  return NextResponse.json(
    {
      ok: true,
      engagementId: loaded.engagementId,
      projectKey: loaded.slug || loaded.engagementId,
      view,
      missing: loaded.result.missing,
      notes: loaded.result.notes,
      documents: loaded.result.documents.map(({ storageKey: _key, ...d }) => d),
      zoho: loaded.zoho,
    },
    { headers: NO_STORE },
  );
}

const postSchema = z.object({ action: z.enum(['fetch_sharepoint', 'ask_client']) });

/**
 * POST — the next step of the sourcing chain from the page: `fetch_sharepoint` starts the
 * SharePoint drop (its review card saves into the tool), `ask_client` drafts a request list.
 * Nothing reaches the client until a person sends the list.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const parsed = await parseJsonBody(request, postSchema);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  const loaded = await loadGstReadiness(auth.ctx, id);
  if (loaded.ok === false) return NextResponse.json({ ok: false, error: loaded.error }, { status: loaded.status });
  if (parsed.data.action === 'fetch_sharepoint') {
    const started = await fetchGstFromSharepoint(auth.ctx, { engagementId: loaded.engagementId, conversationId: null, projectPath: `/projects/${loaded.slug || loaded.engagementId}` });
    if (started.ok === false) return NextResponse.json({ ok: false, error: started.message }, { status: 409 });
    return NextResponse.json({ ok: true, runId: started.runId, message: started.message });
  }
  const asked = await askClientForGst(auth.ctx, { engagementId: loaded.engagementId, missing: loaded.result.missing });
  if (asked.ok === false) return NextResponse.json({ ok: false, error: asked.message }, { status: 409 });
  return NextResponse.json({ ok: true, listId: asked.listId, href: asked.href, message: asked.message });
}
