import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getEngagementById, getEngagementBySlug, listEngagements } from '@/db/repositories/engagements';
import { contentWords, matchCompany } from '@/lib/ask/metrics/match';
import { askClientForGst, fetchGstFromSharepoint, loadGstReadiness } from '@/lib/registrations/gst-sourcing';
import { gstReadinessView, type GstNextAction, type GstReadinessView } from '@/lib/registrations/gst-readiness';
import { GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import type { GstCardData } from './card';
import type { GstIntent } from './intent';

/**
 * Ask VCFO's answer to a GST registration request (`gstIntent`). Code only, no model call: the
 * readiness comes from the profile builder, the SharePoint fetch from the existing drop, the
 * request list from the request-lists repository. Staff only; the pipeline never sends a client
 * here. "Agents prepare. Humans file.": the answer offers the portal; the person signs in,
 * types the OTPs, authenticates Aadhaar and submits with DSC or EVC.
 */


export interface GstWorkAnswer {
  line: string;
  /** The project and step, for the answer's own "Open step" link. */
  target?: { engagementId: string; stepId: string };
  gst?: GstCardData;
  /** A SharePoint drop this answer started; the chat polls it as for any drop. */
  runId?: string;
}

type Row = { id: string; slug: string | null; companyName: string };

async function projectOnPage(ctx: AuthContext, pagePath: string | undefined): Promise<Row | null> {
  const m = pagePath ? /\/(?:projects|engagements|clients|registrations)\/([^/?#]+)/.exec(pagePath) : null;
  if (!m) return null;
  // A registration record's key is `<engagement>~<step>`.
  const key = decodeURIComponent(m[1]!).split('~')[0]!;
  const row = (await getEngagementBySlug(ctx, key)) ?? (/^[0-9a-f-]{36}$/i.test(key) ? await getEngagementById(ctx, key) : null);
  return row ? { id: row.id, slug: row.slug ?? null, companyName: row.companyName } : null;
}

/** The project the message names, else the one on screen. */
export async function resolveGstProject(
  ctx: AuthContext,
  company: string | null,
  pagePath: string | undefined,
): Promise<{ row: Row } | { line: string }> {
  if (company) {
    const rows = await listEngagements(ctx);
    const words = contentWords(company);
    const found = matchCompany(words, rows);
    if (found) return { row: { id: found.id, slug: found.slug ?? null, companyName: found.companyName } };
    const several = rows.filter((r) => contentWords(r.companyName)[0] === words[0]).slice(0, 4);
    return {
      line: several.length > 1
        ? `More than one client could be "${company}": ${several.map((r) => r.companyName).join(', ')}. Say the full name.`
        : `I cannot find a client called "${company}" among your projects.`,
    };
  }
  const onPage = await projectOnPage(ctx, pagePath);
  if (onPage) return { row: onPage };
  return { line: 'Which client should I register for GST? Say "register <client> for GST".' };
}

function card(engagementId: string, projectKey: string, view: GstReadinessView, extra: Partial<GstCardData> = {}): GstCardData {
  const { line: _line, ...rest } = view;
  return { ...rest, engagementId, projectKey, ...extra };
}

export async function gstWorkAnswer(
  ctx: AuthContext,
  intent: GstIntent,
  opts: { conversationId: string | null; pagePath?: string },
): Promise<GstWorkAnswer> {
  if (ctx.role === 'client') return { line: 'GST registration is prepared by the firm. Ask your project lead.' };
  const resolved = await resolveGstProject(ctx, intent.company, opts.pagePath);
  if ('line' in resolved) return { line: resolved.line };
  const { row } = resolved;
  const projectKey = row.slug || row.id;
  const target = { engagementId: projectKey, stepId: GST_STEP_ID };

  if (intent.kind === 'fetch_sharepoint') {
    const started = await fetchGstFromSharepoint(ctx, { engagementId: row.id, conversationId: opts.conversationId, projectPath: `/projects/${projectKey}` });
    if (started.ok === false) return { line: started.message, target };
    return { line: started.message, target, runId: started.runId };
  }

  if (intent.kind === 'ask_client') {
    const asked = await askClientForGst(ctx, { engagementId: row.id });
    if (asked.ok === false) return { line: asked.message, target };
    const loaded = await loadGstReadiness(ctx, row.id);
    const view = loaded.ok ? gstReadinessView(loaded.result, { zohoLinked: loaded.zoho.linked }) : null;
    return {
      line: asked.message,
      target,
      ...(view ? { gst: card(row.id, projectKey, view, { requestHref: asked.href, actions: view.actions.filter((a): a is GstNextAction => a !== 'ask_client') }) } : {}),
    };
  }

  const loaded = await loadGstReadiness(ctx, row.id);
  if (loaded.ok === false) return { line: 'That client is not available.' };
  const view = gstReadinessView(loaded.result, { zohoLinked: loaded.zoho.linked });
  return { line: view.line, target, gst: card(row.id, projectKey, view) };
}
