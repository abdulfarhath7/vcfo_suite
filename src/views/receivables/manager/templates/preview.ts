import { clientStatementEmail, leadershipDigestEmail, newInvoiceEmail, paymentReceivedEmail, revisedInvoiceEmail, rollupEmail, type EmailInvoice } from '@/lib/receivables/email-v2';
import type { SnapshotRow } from '@/lib/receivables/model';
import { summaryEmailHtml, summaryEmailSubject } from '@/lib/receivables/summary-email';
import type { TemplateKind, TemplateOverride } from '@/lib/receivables/templates';

/**
 * The Templates tab's preview (owner, 19 Nov 2026): each email type built by its real builder from
 * sample invoices, with the words being edited. The sample is the same for every sheet, so a
 * preview never shows a real client's invoices to the wrong person.
 */

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function sample(today: string): EmailInvoice[] {
  return [
    { clientName: 'Acme Labs', invoiceNo: 'INV/26-27/101', invoiceDate: addDays(today, -40), dueDate: addDays(today, -10), amountInr: 245000 },
    { clientName: 'Acme Labs', invoiceNo: 'INV/26-27/114', invoiceDate: addDays(today, -20), dueDate: addDays(today, 10), amountInr: 118000 },
    { clientName: 'Blue River Ltd', invoiceNo: 'INV/26-27/120', invoiceDate: addDays(today, -15), dueDate: addDays(today, 15), amountInr: 590000 },
  ];
}

function sampleRows(today: string): SnapshotRow[] {
  const month = `${addDays(today, -40).slice(0, 7)}-01`;
  return sample(today).map((inv, i) => ({
    id: `sample-${i}`,
    invoiceMonth: month,
    clientName: inv.clientName,
    invoiceNo: inv.invoiceNo,
    invoiceDate: inv.invoiceDate,
    partnerId: null,
    partnerSlug: 'sample',
    partnerName: 'Ravi Kumar',
    dueDate: inv.dueDate,
    amountInr: inv.amountInr,
    status: i === 1 ? 'received' : 'open',
    paidOn: i === 1 ? today : null,
    paidAmount: i === 1 ? inv.amountInr : null,
    paidVia: null,
    partPaid: 0,
    remindersPausedUntil: null,
    pauseReason: null,
  })) as SnapshotRow[];
}

/** A whole HTML page for the preview frame (the summary body is a fragment, so it is wrapped). */
const wrap = (html: string) =>
  html.startsWith('<!DOCTYPE') ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;background:#fff;">${html}</body></html>`;

export function previewOf(kind: TemplateKind, tpl: TemplateOverride, ctx: { today: string; signName: string; sheetName: string }): { subject: string; html: string } {
  const { today, signName: senderName, sheetName } = ctx;
  const inv = sample(today);
  switch (kind) {
    case 'summary':
      return {
        subject: summaryEmailSubject(today, tpl, sheetName),
        html: wrap(summaryEmailHtml({ rows: sampleRows(today), today, liveUrl: '', signerName: senderName, template: tpl, sheetName, greetName: 'Ravi', picked: true })),
      };
    case 'new_invoice': {
      const m = newInvoiceEmail({ partnerName: 'Ravi Kumar', senderName, invoices: [inv[0]!], today, tpl });
      return { subject: m.subject, html: m.html };
    }
    case 'revised': {
      const m = revisedInvoiceEmail({ partnerName: 'Ravi Kumar', senderName, invoice: { ...inv[0]!, oldAmountInr: 260000, reason: 'Discount agreed with the client' }, today, tpl });
      return { subject: m.subject, html: m.html };
    }
    case 'rollup': {
      const m = rollupEmail({ partnerName: 'Ravi Kumar', senderName, invoices: inv, today, clientOrgName: sheetName, tpl });
      return { subject: m.subject, html: m.html };
    }
    case 'digest': {
      const m = leadershipDigestEmail({ senderName, invoices: inv.map((r, i) => ({ ...r, partnerName: i === 2 ? 'Meera Shah' : 'Ravi Kumar' })), today, clientOrgName: sheetName, tpl });
      return { subject: m.subject, html: m.html };
    }
    case 'statement': {
      const m = clientStatementEmail({ clientName: 'Acme Labs', senderName, invoices: inv.slice(0, 2), today, tpl });
      return { subject: m.subject, html: m.html };
    }
    case 'payment_received': {
      const m = paymentReceivedEmail({ recipientName: 'Ravi Kumar', senderName, invoices: [{ ...inv[1]!, paidOn: today, receivedInr: inv[1]!.amountInr }], today, tpl });
      return { subject: m.subject, html: m.html };
    }
  }
}
