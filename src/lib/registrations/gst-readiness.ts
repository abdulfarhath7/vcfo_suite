import type { RequestItemKind } from '@/data/request-templates';
import type { GstMissing, GstProfileResult, GstSource } from './gst-profile';
import { gstGapsBySource } from './gst-profile-build';

/**
 * GST READINESS — the words and the next steps for a GST application that is or is not ready,
 * shared by Ask VCFO (answered without a model call), the reg-4 page and the tests. Pure.
 */

export type GstNextAction = 'fetch_sharepoint' | 'ask_client' | 'start_portal' | 'open_step' | 'confirm_client';

export interface GstReadinessView {
  companyName: string;
  ready: boolean;
  /** One plain line for the chat. */
  line: string;
  /** Up to eight required gaps, the chain's order, for the card. */
  gaps: Array<{ key: string; label: string; source: GstSource; where: string; kind: 'value' | 'document' }>;
  /** How many required gaps there are in all. */
  gapCount: number;
  /** Values the client entered on the GST step that need the lead's confirmation; they do not block. */
  confirm: Array<{ key: string; label: string }>;
  actions: GstNextAction[];
}

const SOURCE_WORD: Record<GstSource, string> = {
  tool: 'in the tool',
  sharepoint: 'from the client’s papers (SharePoint)',
  zoho: 'from Zoho',
  client: 'from the client',
  portal: 'on the GST portal',
};

const GAPS_SHOWN = 8;

/** The readiness card's content. `zohoLinked` adds the Zoho line when the client's org is linked. */
export function gstReadinessView(
  result: Pick<GstProfileResult, 'companyName' | 'missing' | 'readiness'> & Partial<Pick<GstProfileResult, 'confirm'>>,
  opts: { zohoLinked?: boolean } = {},
): GstReadinessView {
  const groups = gstGapsBySource(result.missing);
  const required = groups.flatMap((g) => g.items);
  const company = result.companyName || 'this client';
  const confirm = (result.confirm ?? []).slice(0, GAPS_SHOWN);
  const confirmCount = result.confirm?.length ?? 0;
  // Not missing and not blocking: the existing confirm on the GST step is a check, not a gate.
  const confirmLine = confirmCount
    ? ` ${confirmCount} ${confirmCount === 1 ? 'value the client entered needs' : 'values the client entered need'} your confirmation.`
    : '';
  const confirmAction: GstNextAction[] = confirmCount ? ['confirm_client'] : [];
  if (required.length === 0) {
    return {
      companyName: company,
      ready: true,
      line: `${company} is ready for GST registration: every value REG-01 needs is in the tool.${confirmLine} Start on the GST portal; you sign in, type the OTPs, do the Aadhaar authentication and submit with DSC or EVC.`,
      gaps: [],
      gapCount: 0,
      confirm,
      actions: [...confirmAction, 'start_portal', 'open_step'],
    };
  }
  const parts = groups.map((g) => `${g.items.length} ${SOURCE_WORD[g.source]}`);
  const fromPapers = groups.some((g) => g.source === 'sharepoint');
  const fromClient = groups.some((g) => g.source === 'client' || g.source === 'sharepoint');
  const actions: GstNextAction[] = [...confirmAction];
  if (fromPapers) actions.push('fetch_sharepoint');
  if (fromClient) actions.push('ask_client');
  actions.push('open_step');
  const zoho = opts.zohoLinked ? ' The client’s Zoho org is linked; Zoho holds no registration papers, so the chain goes on to SharePoint and the client.' : '';
  return {
    companyName: company,
    ready: false,
    line: `${company} is not ready for GST registration yet: ${required.length} required ${required.length === 1 ? 'item is' : 'items are'} missing (${parts.join(', ')}).${fromPapers ? ' I can read the papers from SharePoint into the tool first.' : ''}${zoho}${confirmLine}`,
    gaps: required.slice(0, GAPS_SHOWN).map((m) => ({ key: m.key, label: m.label, source: m.source, where: m.where, kind: m.kind })),
    gapCount: required.length,
    confirm,
    actions,
  };
}

/**
 * The request list items for the client: every required gap the client or the client's papers
 * fill. Portal look-ups and tool settings are the firm's, so they are left out.
 */
export function gstClientRequestItems(missing: GstMissing[]): Array<{ kind: RequestItemKind; label: string; help: string | null }> {
  const seen = new Set<string>();
  const out: Array<{ kind: RequestItemKind; label: string; help: string | null }> = [];
  for (const m of missing) {
    if (!m.required || (m.source !== 'client' && m.source !== 'sharepoint')) continue;
    const label = m.kind === 'document' ? `${m.label} (upload)` : m.label;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ kind: m.kind === 'document' ? 'document' : 'answer', label, help: 'Needed for the GST registration application (REG-01).' });
  }
  return out;
}
