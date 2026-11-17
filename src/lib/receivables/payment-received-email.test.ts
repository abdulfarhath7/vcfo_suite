import { describe, expect, it } from 'vitest';
import { paymentReceivedEmail } from './email-v2';

const inv = (clientName: string, receivedInr: number) => ({ clientName, invoiceNo: 'SCSPL/26-27/164', invoiceDate: '2026-10-09', dueDate: '2026-10-16', amountInr: receivedInr, paidOn: '2026-11-17', receivedInr });

describe('paymentReceivedEmail', () => {
  it('lists one received invoice with its date and amount, in the SBC table, with no link', () => {
    const m = paymentReceivedEmail({ recipientName: 'Pranay Kumar', senderName: 'Phani', invoices: [inv('Emburse India Private Limited', 2404540.6)] });
    expect(m.subject).toBe('Payment received · Emburse India Private Limited · ₹24,04,540.60');
    expect(m.html).toContain('Hi Pranay,');
    expect(m.html).toContain('17-Nov-26');
    expect(m.html).toContain('#e35f2a');
    expect(m.html).not.toContain('href=');
    expect(m.text).toContain('Regards,\nPhani · SBC');
  });

  it('adds a client column and a total for several clients', () => {
    const m = paymentReceivedEmail({ recipientName: 'Team', senderName: 'Phani', invoices: [inv('Bupa', 100), inv('Vena', 200)] });
    expect(m.subject).toBe('Payments received · 2 invoices · ₹300.00');
    expect(m.html).toContain('>Client<');
    expect(m.html).toContain('300.00');
  });
});
