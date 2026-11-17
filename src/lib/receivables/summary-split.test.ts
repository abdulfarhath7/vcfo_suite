import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/repositories/receivables', () => ({ finishSummarySend: vi.fn() }));
vi.mock('@/db/repositories/outlook-connections', () => ({ sendMailViaOutlook: vi.fn() }));

import { splitSummaryForPartners } from './summary-send';
import type { Partner, SnapshotRow } from './model';

const partner = (slug: string, email: string): Partner => ({ id: `id-${slug}`, slug, name: slug, email, active: true });
const row = (clientName: string, partnerSlug: string | null): SnapshotRow =>
  ({ id: clientName, invoiceMonth: '2026-10-01', clientName, invoiceNo: null, partnerId: partnerSlug ? `id-${partnerSlug}` : null, dueDate: '2026-11-30', amountInr: 1000, status: 'open', paidOn: null, paidAmount: null, paidVia: null, partPaid: 0, remindersPausedUntil: null, pauseReason: null, partnerSlug, partnerName: partnerSlug }) as SnapshotRow;

const partners = [partner('pranay', 'pranay@sbcllp.in'), partner('jeyansh', 'jeyansh@sbcllp.in'), partner('farhath', 'farhath@sbcllp.in')];
const snapshot = [row('Emburse', 'pranay'), row('Raptor', 'jeyansh'), row('Bupa', null)];

describe('splitSummaryForPartners', () => {
  it('gives each client partner an email with only their own invoices, and never the shared one', () => {
    const mails = splitSummaryForPartners({
      people: { to: [{ name: '', email: 'Pranay@sbcllp.in' }, { name: '', email: 'jeyansh@sbcllp.in' }, { name: '', email: 'ceo@sbcllp.in' }], cc: [{ name: '', email: 'farhath@sbcllp.in' }], bcc: [] },
      partners,
      snapshot,
      today: '2026-11-17',
      signerName: 'Phani',
      subject: 'Receivables update - 17 November',
      html: '<p>Emburse Raptor Bupa</p>',
    });
    const shared = mails.find((m) => m.to.includes('ceo@sbcllp.in'))!;
    expect(shared).toMatchObject({ to: ['ceo@sbcllp.in'], cc: [], bcc: [], html: '<p>Emburse Raptor Bupa</p>' });
    const pranay = mails.find((m) => m.to[0] === 'pranay@sbcllp.in')!;
    expect(pranay.html).toContain('Emburse');
    expect(pranay.html).not.toContain('Raptor');
    expect(pranay.html).not.toContain('Bupa');
    const jeyansh = mails.find((m) => m.to[0] === 'jeyansh@sbcllp.in')!;
    expect(jeyansh.html).toContain('Raptor');
    expect(jeyansh.html).not.toContain('Emburse');
    // Farhath has no invoices: no email at all.
    expect(mails.some((m) => [...m.to, ...m.cc, ...m.bcc].includes('farhath@sbcllp.in'))).toBe(false);
    expect(mails).toHaveLength(3);
  });

  it('sends no shared email when every recipient is a client partner', () => {
    const mails = splitSummaryForPartners({ people: { to: [{ name: '', email: 'pranay@sbcllp.in' }], cc: [], bcc: [] }, partners, snapshot, today: '2026-11-17', signerName: 'P', subject: 's', html: '<p>all</p>' });
    expect(mails).toHaveLength(1);
    expect(mails[0].html).not.toContain('<p>all</p>');
  });
});
