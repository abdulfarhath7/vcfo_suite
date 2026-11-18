import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/site-url';
import { todayIst } from '@/lib/receivables/dates';
import { publicPageUrl } from '@/lib/receivables/links';
import { contactSuggestions, recipientLists } from '@/lib/receivables/recipients';
import { partnerRows, summaryEmailHtml, summaryEmailSubject } from '@/lib/receivables/summary-email';
import { getSignName, getSummarySource, listDigestRecipients } from '@/db/repositories/receivables';
import type { PartnerDraftDto } from '@/lib/receivables/wire';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * GET /api/receivables/sheets/:id/summary — the summary email ready to edit: subject, body in the
 * finance team's format built from the published version, the ready-made recipient lists and the
 * contacts to suggest; one ready email per client partner (only their own clients) and the
 * leadership recipients, who get the whole sheet. 409 not_published before the first Update.
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    const [src, signerName] = await Promise.all([getSummarySource(guard.ctx, id), getSignName(guard.ctx)]);
    // The live sheet, not the last published version: the email shows what the table shows now.
    const rows = src.live;
    const today = todayIst();
    const liveUrl = publicPageUrl(siteUrl(), src.sheet);
    const leaders = (await listDigestRecipients(guard.ctx, id)).filter((r) => r.active).map((r) => ({ name: r.name, email: r.email }));
    // One ready email per active client partner, with only the invoices of that partner's clients
    // (the ones they lead and the ones they are a second partner on).
    const partnerDrafts: PartnerDraftDto[] = src.partners
      .filter((p) => p.active)
      .map((p) => ({
        partnerId: p.id,
        name: p.name,
        email: p.email,
        invoiceCount: partnerRows(rows, p.slug, src.coClientKeys[p.id]).filter((r) => r.status === 'open').length,
        html: summaryEmailHtml({ rows, today, liveUrl, signerName, partnerSlug: p.slug, alsoClientKeys: src.coClientKeys[p.id] }),
      }));
    return NextResponse.json({
      versionSeq: src.version.seq,
      publishedAt: src.version.publishedAt,
      subject: src.lastSend?.subject.startsWith('RE:') ? `RE: ${summaryEmailSubject(today)}` : summaryEmailSubject(today),
      html: summaryEmailHtml({ rows, today, liveUrl, signerName }),
      signName: signerName,
      lists: recipientLists({ partners: src.partners, rows, today, lastSend: src.lastSend }),
      contacts: [...contactSuggestions(src.partners, src.lastSend), ...leaders.filter((l) => !src.partners.some((p) => p.email.toLowerCase() === l.email.toLowerCase()))],
      partnerDrafts,
      leaders,
      lastSentAt: src.lastSend?.sentAt ?? null,
      lastSendStatus: src.lastSend?.status ?? null,
    });
  } catch (e) {
    return receivablesError(e);
  }
}
