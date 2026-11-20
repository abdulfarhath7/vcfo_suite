import 'server-only';
import { systemTeamWhatsApp } from '@/db/repositories/receivables';
import { isDoubleTickConfigured, readDoubleTickConfig, sendDoubleTickMessage } from '@/lib/notify/send-whatsapp-doubletick';
import { siteUrl } from '@/lib/site-url';

/**
 * The Team's WhatsApp updates (owner, 20 Nov 2026): one message per event to every member of the
 * sheet with "WhatsApp updates" on and a valid number — emails waiting for approval, approved and
 * sent, skipped, failed, the Send email and payments marked received. It uses the approved
 * receivables template (`DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT`), whose four values are read
 * here as: what happened, the member's name, the sheet, and the link to open. Never throws: a
 * WhatsApp failure must never stop the email or the action it reports.
 */
export async function notifyTeam(sheetId: string, what: string, opts: { sheetName?: string; tab?: string; exceptUserId?: string | null } = {}): Promise<number> {
  try {
    const config = readDoubleTickConfig();
    if (!isDoubleTickConfigured(config)) return 0;
    const people = (await systemTeamWhatsApp(sheetId)).filter((p) => p.userId !== opts.exceptUserId);
    const link = `${siteUrl()}/receivables/manager?sheet=${sheetId}&tab=${opts.tab ?? 'emails'}`;
    let sent = 0;
    for (const p of people) {
      const res = await sendDoubleTickMessage({
        to: p.phone,
        templateName: config.receivablesTemplate || null,
        variables: [what.slice(0, 200), p.name, opts.sheetName ?? 'Receivables', link],
        text: `${what}\n${link}`,
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
