import { describe, expect, it } from 'vitest';
import { collectionsReport } from './collections';
import { collectionsEmailHtml, collectionsEmailSubject } from './collections-email';
import type { SheetInvoice } from './model';

const inv = (o: Partial<SheetInvoice>) =>
  ({ id: 'x', clientName: 'Acme', invoiceNo: 'INV-1', partnerId: 'p1', dueDate: '2026-11-10', amountInr: 1000, status: 'received', paidOn: '2026-11-08', paidAmount: 1000, partPaid: 0, currency: 'INR', ...o }) as SheetInvoice;
const invoices = [inv({ id: 'a' }), inv({ id: 'b', clientName: 'Blue', invoiceNo: 'INV-2', partnerId: 'p2', paidOn: '2026-11-15' })];
const base = { today: '2026-11-19', periodLabel: 'This financial year', signerName: 'Phani', partnerName: (id: string | null) => (id === 'p1' ? 'Ravi' : 'Meera') };

describe('collections email', () => {
  it('shows the on-time share, the tables and each received invoice', () => {
    const report = collectionsReport(invoices, { today: '2026-11-19', period: 'fy' });
    const html = collectionsEmailHtml({ ...base, report, showPartners: true });
    expect(html).toContain('50% received on time');
    expect(html).toContain('By month received');
    expect(html).toContain('By client partner');
    expect(html).toContain('2 days early');
    expect(html).toContain('5 days late');
    expect(collectionsEmailSubject({ ...base, report })).toBe('Collections · This financial year · 50% on time');
  });

  it("a partner's report holds only their invoices and no partner table", () => {
    const report = collectionsReport(invoices, { today: '2026-11-19', period: 'fy', partnerId: 'p1' });
    const html = collectionsEmailHtml({ ...base, report, showPartners: false, greetName: 'Ravi' });
    expect(html).toContain('Hi Ravi,');
    expect(html).toContain('INV-1');
    expect(html).not.toContain('INV-2');
    expect(html).not.toContain('By client partner');
  });

  it('uses the saved words', () => {
    const report = collectionsReport(invoices, { today: '2026-11-19', period: 'fy' });
    const html = collectionsEmailHtml({ ...base, report, showPartners: true, template: { intro: 'Collections for {period}: {ontime}.' } });
    expect(html).toContain('Collections for this financial year: 50%.');
  });
});
