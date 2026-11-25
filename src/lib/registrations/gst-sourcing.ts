import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getGstProfile } from '@/db/repositories/gst-profile';
import { createRequestList, RequestListError } from '@/db/repositories/request-lists';
import { requestsPageHref } from '@/lib/request-lists/model';
import { startSharepointDrop } from '@/lib/sharepoint/start-drop';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import type { GstMissing, GstProfileResult } from './gst-profile';
import { gstGapsBySource } from './gst-profile-build';
import { gstClientRequestItems } from './gst-readiness';

/**
 * Where the GST application's missing values come from, in order (owner brief, 25 Nov 2026):
 *   (a) the tool: the checklist and the GST step's own fields (the profile builder reads them);
 *   (b) the client's SharePoint folder: the existing drop reads the PAN card, the certificate of
 *       incorporation, the rent deed, the electricity bill, the NOC, the bank letter and the
 *       photographs into one review card whose rows target the tool's fields;
 *   (c) Zoho, when the firm has linked the client's Zoho org (read through the integrations hub's
 *       public functions only; skipped when the hub is not there);
 *   (d) otherwise a draft request list to the client.
 * Values are saved into the tool first (the card's Save or "Fill into app"); only then does the
 * extension fill the portal, from the tool. Nothing here writes to a government portal.
 */

export type GstReadinessLoad =
  | { ok: true; engagementId: string; slug: string | null; result: GstProfileResult; zoho: { linked: boolean; name?: string } }
  | { ok: false; status: number; error: string };

/** The readiness of one engagement's GST application, for a staff caller. */
export async function loadGstReadiness(ctx: AuthContext, engagementParam: string): Promise<GstReadinessLoad> {
  const loaded = await getGstProfile(ctx, engagementParam);
  if (loaded.ok === false) return loaded;
  const engagementId = appEngagementId(loaded.inputs.dbId);
  return {
    ok: true,
    engagementId,
    slug: loaded.inputs.engagement.slug ?? null,
    result: loaded.result,
    zoho: await zohoLink(ctx, engagementId),
  };
}

/**
 * (c) Zoho: whether the client's Zoho Books org is linked. The hub is optional; any failure (not
 * built, not connected, not allowed) reads as not linked, so the chain goes on to the client.
 */
export async function zohoLink(ctx: AuthContext, engagementId: string): Promise<{ linked: boolean; name?: string }> {
  try {
    const hub = (await import('@/db/repositories/integrations')) as unknown as {
      mappedOrgForEngagement?: (c: AuthContext, id: string, app: 'books') => Promise<{ name: string } | null>;
    };
    if (typeof hub.mappedOrgForEngagement !== 'function') return { linked: false };
    const org = await hub.mappedOrgForEngagement(ctx, engagementId, 'books');
    return org ? { linked: true, name: org.name } : { linked: false };
  } catch {
    return { linked: false };
  }
}

const SHAREPOINT_ASK =
  'GST registration: read the PAN card, the certificate of incorporation, the rent agreement, the electricity bill, the NOC from the owner, the bank letter and the directors’ photographs, and fill the tool from them.';

/** (b) Start the SharePoint drop for the GST papers; its review card saves into the tool. */
export async function fetchGstFromSharepoint(
  ctx: AuthContext,
  input: { engagementId: string; conversationId: string | null; projectPath?: string },
): Promise<{ ok: true; runId: string; message: string } | { ok: false; message: string }> {
  const started = await startSharepointDrop(ctx, { ...input, message: SHAREPOINT_ASK });
  if (started.ok === false) return { ok: false, message: started.message };
  return {
    ok: true,
    runId: started.runId,
    message: `Reading ${started.sources} for ${started.companyName}. A review card follows; save it into the tool, then start on the GST portal.`,
  };
}

/** (d) A draft request list to the client for what only the client (or their papers) can give. */
export async function askClientForGst(
  ctx: AuthContext,
  input: { engagementId: string; missing?: GstMissing[] },
): Promise<{ ok: true; listId: string; href: string; items: number; message: string } | { ok: false; message: string }> {
  let missing = input.missing;
  let companyName = '';
  if (!missing) {
    const loaded = await loadGstReadiness(ctx, input.engagementId);
    if (loaded.ok === false) return { ok: false, message: 'This project is not available.' };
    missing = loaded.result.missing;
    companyName = loaded.result.companyName;
  }
  const items = gstClientRequestItems(missing);
  if (items.length === 0) return { ok: false, message: 'Nothing is left that the client has to give.' };
  try {
    const list = await createRequestList(ctx, {
      engagementId: input.engagementId,
      title: 'GST registration details',
      templateId: null,
      cadenceDays: 3,
      items,
    });
    const name = companyName || list.companyName || 'the client';
    return {
      ok: true,
      listId: list.id,
      href: `${requestsPageHref(ctx.role)}?list=${encodeURIComponent(list.id)}`,
      items: items.length,
      message: `I drafted a request list for ${name} with ${items.length} item${items.length === 1 ? '' : 's'}. Review it and send it from Requests; nothing goes to the client until you send it.`,
    };
  } catch (error) {
    if (error instanceof RequestListError) return { ok: false, message: error.message };
    throw error;
  }
}

export { gstGapsBySource };
