import { describe, expect, it } from 'vitest';
import { cleanTemplate, fillTemplate, partOf, changedParts } from './templates';
import { newInvoiceEmail, paymentReceivedEmail } from './email-v2';
import { summaryEmailHtml, summaryEmailSubject } from './summary-email';
import type { SnapshotRow } from './model';

const INV = { clientName: 'Acme', invoiceNo: 'INV-1', invoiceDate: '2026-10-01', dueDate: '2026-11-30', amountInr: 1000 };

describe('templates', () => {
  it('trims, cuts and drops empty parts', () => {
    expect(cleanTemplate({ subject: '  Hello   {name}  ', intro: '', closing: ' Thanks ', other: 'x' })).toEqual({ subject: 'Hello {name}', closing: 'Thanks' });
    expect(cleanTemplate(null)).toEqual({});
    expect(cleanTemplate({ intro: 'a'.repeat(3000) }).intro).toHaveLength(2000);
  });

  it('fills known placeholders and keeps unknown ones as typed', () => {
    expect(fillTemplate('Hi {name}, {unknown} {total}', { name: 'Ravi', total: '1,000.00' })).toBe('Hi Ravi, {unknown} 1,000.00');
    expect(partOf({ subject: ' ' }, 'subject', {})).toBeNull();
    expect(changedParts({ greeting: 'Dear {name},', intro: '' })).toEqual(['greeting']);
  });

  it('keeps the standard words when nothing is saved', () => {
    const std = newInvoiceEmail({ partnerName: 'Ravi Kumar', senderName: 'Phani', invoices: [INV], today: '2026-11-19' });
    const empty = newInvoiceEmail({ partnerName: 'Ravi Kumar', senderName: 'Phani', invoices: [INV], today: '2026-11-19', tpl: {} });
    expect(empty).toEqual(std);
    expect(std.subject).toBe('New invoice INV-1 · Acme');
  });

  it('uses the saved subject, greeting, opening and closing, escaped', () => {
    const m = newInvoiceEmail({
      partnerName: 'Ravi Kumar',
      senderName: 'Phani',
      invoices: [INV],
      today: '2026-11-19',
      tpl: { subject: 'Invoice for {client}', greeting: 'Dear {name},', intro: 'New <b>bill</b>:\n\nSecond paragraph', closing: 'Please follow up.' },
    });
    expect(m.subject).toBe('Invoice for Acme');
    expect(m.html).toContain('Dear Ravi,');
    expect(m.html).toContain('New &lt;b&gt;bill&lt;/b&gt;:');
    expect(m.html).toContain('Second paragraph');
    expect(m.html).toContain('Please follow up.');
    expect(m.text).toContain('Dear Ravi,\n\nNew <b>bill</b>:');
  });

  it('a saved closing replaces "Thank you." on the payment received email', () => {
    const m = paymentReceivedEmail({ recipientName: 'Ravi', senderName: 'Phani', invoices: [{ ...INV, paidOn: '2026-11-18', receivedInr: 1000 }], tpl: { closing: 'Much obliged.' } });
    expect(m.html).toContain('Much obliged.');
    expect(m.html).not.toContain('Thank you.');
  });

  it('the summary email takes the saved words and greets by name', () => {
    const row = {
      id: 'a',
      invoiceMonth: '2026-10-01',
      clientName: 'Acme',
      invoiceNo: 'INV-1',
      partnerId: null,
      partnerSlug: 'r',
      partnerName: 'Ravi',
      dueDate: '2026-11-30',
      amountInr: 1000,
      status: 'open',
      paidOn: null,
      paidAmount: null,
      paidVia: null,
      partPaid: 0,
      remindersPausedUntil: null,
      pauseReason: null,
    } as SnapshotRow;
    const std = summaryEmailHtml({ rows: [row], today: '2026-11-19', liveUrl: '', signerName: 'Phani' });
    expect(std).toContain('Hi Team,');
    expect(std).toContain('Please find the receivables summary as of today:');
    const custom = summaryEmailHtml({ rows: [row], today: '2026-11-19', liveUrl: '', signerName: 'Phani', greetName: 'Ravi', sheetName: 'Summit', template: { greeting: 'Dear {name},', intro: 'The {sheet} sheet:', closing: 'Thanks.' } });
    expect(custom).toContain('Dear Ravi,');
    expect(custom).toContain('The Summit sheet:');
    expect(custom).toContain('Thanks.');
    expect(summaryEmailSubject('2026-11-19')).toBe('Receivables update - 19 November');
    expect(summaryEmailSubject('2026-11-19', { subject: '{sheet} update · {date}' }, 'Summit')).toBe('Summit update · 19 November');
  });
});
