import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { getOutlookStatus } from '@/db/repositories/outlook-connections';
import { systemTeamWhatsApp } from '@/db/repositories/receivables';
import { isDoubleTickConfigured, readDoubleTickConfig, sendDoubleTickMessage, type DoubleTickConfig } from '@/lib/notify/send-whatsapp-doubletick';
import { siteUrl } from '@/lib/site-url';

/**
 * The Team's WhatsApp updates (owner, 20 Nov 2026): one message per event to every member of the
 * sheet with "WhatsApp updates" on and a valid number — emails waiting for approval, approved and
 * sent, skipped, the Send email and payments marked received. Never throws: a WhatsApp failure
 * must never stop the email or the action it reports.
 *
 * Wording: the team's own template `vcfo_team_update` (created on DoubleTick 20 Nov 2026):
 *   "VCFO Suite receivables update: {{1}} • From: {{2}} • To: {{3}} • Open: {{4}} …"
 * Until Meta approves it, the old `vcfo_email_sent_ping` ("Subject / To / Address / Open it") is
 * used with the values placed so that only email addresses show, never names (owner, 20 Nov 2026).
 * The approval is read from DoubleTick and kept for 15 minutes, so the switch needs no deploy.
 */
export const TEAM_TEMPLATE = 'vcfo_team_update';

let approved: { at: number; ok: boolean } | null = null;
async function teamTemplateApproved(config: DoubleTickConfig): Promise<boolean> {
  if (approved && Date.now() - approved.at < 15 * 60_000) return approved.ok;
  let ok = false;
  try {
    const res = await fetch(`${config.baseUrl}/templates?wabaNumber=${encodeURIComponent(config.fromNumber.replace(/\D/g, ''))}`, { headers: { Authorization: config.apiKey } });
    if (res.ok) ok = JSON.stringify(await res.json()).match(new RegExp(`"name":"${TEAM_TEMPLATE}"[^}]*?"status":"APPROVED"`)) !== null;
  } catch {
    ok = false;
  }
  approved = { at: Date.now(), ok };
  return ok;
}

/** "a@x.in", "a@x.in, b@x.in and 3 more", or "—". */
export function emailList(list: string[], max = 2): string {
  const unique = [...new Set(list.map((e) => e.trim()).filter(Boolean))];
  if (!unique.length) return '—';
  return unique.length > max ? `${unique.slice(0, max).join(', ')} and ${unique.length - max} more` : unique.join(', ');
}

/** The Outlook address a person sends from, or their login email. */
export async function fromEmailOf(ctx: AuthContext): Promise<string> {
  try {
    const s = await getOutlookStatus(ctx);
    return (s.connected && s.msEmail) || ctx.email || '—';
  } catch {
    return ctx.email || '—';
  }
}

export async function notifyTeam(
  sheetId: string,
  what: string,
  opts: { from?: string; to?: string[]; tab?: string; exceptUserId?: string | null } = {},
): Promise<number> {
  try {
    const config = readDoubleTickConfig();
    if (!isDoubleTickConfigured(config)) return 0;
    const people = (await systemTeamWhatsApp(sheetId)).filter((p) => p.userId !== opts.exceptUserId);
    if (!people.length) return 0;
    const link = `${siteUrl()}/receivables/manager?sheet=${sheetId}&tab=${opts.tab ?? 'emails'}`;
    const from = opts.from || '—';
    const to = emailList(opts.to ?? []);
    const own = await teamTemplateApproved(config);
    // Old template: Subject = what happened, To = the recipients' emails, Address = the from email.
    const variables = own ? [what.slice(0, 200), from, to, link] : [what.slice(0, 200), to, from, link];
    let sent = 0;
    for (const p of people) {
      const res = await sendDoubleTickMessage({
        to: p.phone,
        templateName: own ? TEAM_TEMPLATE : config.receivablesTemplate || null,
        variables,
        text: `VCFO Suite receivables update: ${what}\nFrom: ${from}\nTo: ${to}\nOpen: ${link}`,
        config,
      });
      if (res.ok) sent += 1;
      else console.warn('[receivables] team WhatsApp not sent', 'error' in res ? res.error : '');
    }
    return sent;
  } catch (e) {
    console.error('[receivables] team WhatsApp failed', e instanceof Error ? e.message.slice(0, 200) : e);
    return 0;
  }
}

/** "1 email", "3 emails". */
export const emails = (n: number) => `${n} email${n === 1 ? '' : 's'}`;
