import { describe, expect, it } from 'vitest';
import type { SnapshotRow } from './model';
import { sheetTotals, payTiming } from './summary';
import { depositsSectionHtml, summaryEmailHtml, summaryEmailSubject, withDepositsSection } from './summary-email';

const TODAY = '2026-11-03';
const row = (over: Partial<SnapshotRow>): SnapshotRow => ({
  id: 'x',
  invoiceMonth: '2026-09-01',
  clientName: 'Client',
  invoiceNo: null,
  partnerId: null,
  partnerSlug: 'yash',
  partnerName: 'Yash Babbar',
  dueDate: '2026-10-30',
  amountInr: 0,
  status: 'open',
  paidOn: null,
  paidAmount: null,
  paidVia: null,
  partPaid: 0,
  remindersPausedUntil: null,
  pauseReason: null,
  ...over,
});

const ROWS: SnapshotRow[] = [
  row({ id: 'a', invoiceMonth: '2026-08-01', clientName: 'Bupa', dueDate: '2026-11-02', amountInr: 2010500, partnerSlug: 'sandeep' }),
  row({ id: 'b', clientName: 'Emburse', amountInr: 22757764, status: 'received', paidOn: '2026-11-01', paidAmount: 22757764 }),
  row({ id: 'c', clientName: 'Duravant', dueDate: '2026-10-16', amountInr: 6456984 }),
  row({ id: 'd', clientName: 'Vena', dueDate: '2026-11-13', amountInr: 3443910 }),
  row({ id: 'e', clientName: 'Old', amountInr: 100, status: 'received', paidOn: '2026-10-01', paidAmount: 100 }),
];

describe('sheetTotals', () => {
  it('adds open, overdue and this week’s receipts', () => {
    expect(sheetTotals(ROWS, TODAY)).toEqual({
      openInr: 2010500 + 6456984 + 3443910,
      openCount: 3,
      overdueInr: 2010500 + 6456984,
      overdueCount: 2,
      oldestOverdueDays: 18,
      receivedWeekInr: 22757764,
      receivedWeekCount: 1,
    });
  });

  it('describes payment timing', () => {
    expect(payTiming(ROWS[1])).toBe('2 days late');
    expect(payTiming({ dueDate: '2026-11-05', paidOn: '2026-11-02' })).toBe('3 days early');
    expect(payTiming({ dueDate: '2026-11-05', paidOn: '2026-11-05' })).toBe('On the due date');
  });
});

describe('summaryEmailHtml', () => {
  it('shows every picked invoice, even one received long ago', () => {
    const old = row({ clientName: 'Paid Long Ago', status: 'received', paidOn: '2026-01-05', paidAmount: 10 });
    expect(summaryEmailHtml({ rows: [old], today: TODAY, liveUrl: 'u', signerName: 's' })).not.toContain('Paid Long Ago');
    expect(summaryEmailHtml({ rows: [old], today: TODAY, liveUrl: 'u', signerName: 's', picked: true })).toContain('Paid Long Ago');
  });

  it('marks the signer name so the name box can change it', async () => {
    const { withSignName } = await import('./sign-name');
    const html = summaryEmailHtml({ rows: [row({ amountInr: 1 })], today: TODAY, liveUrl: 'u', signerName: 'Phani' });
    expect(html).toContain('<span data-sign-name="1">Phani</span>');
    expect(withSignName(html, 'Phani Kumar <SBC>')).toContain('<span data-sign-name="1">Phani Kumar &lt;SBC&gt;</span>');
  });

  const html = summaryEmailHtml({ rows: ROWS, today: TODAY, liveUrl: 'https://app.sbctrack.in/receivables/k/abc', signerName: 'Krishna Tungam' });

  it('opens with the payments received this week', () => {
    expect(html).toContain('We have received the following payments:');
    expect(html).toContain('<b>Emburse</b> - September 2026');
    expect(html).not.toContain('<b>Old</b>');
  });

  it('keeps the sheet layout and totals', () => {
    expect(html).toContain('>August-26<');
    expect(html).toContain('>September-26<');
    // Client, amount and remarks only (owner, 23 Nov 2026).
    expect(html).toContain('>Client<');
    expect(html).toContain('>Amount (₹)<');
    expect(html).toContain('>Remarks<');
    for (const gone of ['Invoice no.', 'Invoice date', 'Partner', 'Due date', 'Received date', 'Status', 'Overdue']) expect(html).not.toContain(gone);
    expect(html).not.toContain('SBC');
    expect(html).toContain('>Received<'); // the remark a received row starts with
    expect(html).toContain("Still open in Sep'26");
    expect(html).toContain('99,00,894'); // Sep open: Duravant + Vena
    expect(html).toContain('1,19,11,394'); // total open
    // Receivables v2: no link to the tool in any receivables email.
    expect(html).not.toContain('app.sbctrack.in/receivables/k/abc');
  });

  it('can be cut to one partner', () => {
    const mine = summaryEmailHtml({ rows: ROWS, today: TODAY, liveUrl: 'u', signerName: 's', partnerSlug: 'sandeep' });
    expect(mine).toContain('Bupa');
    expect(mine).not.toContain('Duravant');
    expect(mine).toContain('No new payments');
  });

  it('escapes client names', () => {
    expect(summaryEmailHtml({ rows: [row({ clientName: '<x>', amountInr: 1 })], today: TODAY, liveUrl: 'u', signerName: 's' })).toContain('&lt;x&gt;');
  });

  it('shows a foreign invoice by its INR amount, with no currency columns', () => {
    const mixed = summaryEmailHtml({
      rows: [...ROWS, row({ id: 'f', clientName: 'Vena US', dueDate: '2026-11-20', amountInr: 999000, currency: 'USD', fcAmount: 12000, fxRate: 83.25 })],
      today: TODAY,
      liveUrl: 'u',
      signerName: 's',
    });
    expect(mixed).not.toContain('Currency');
    expect(mixed).not.toContain('USD Amount');
    expect(mixed).toContain('colspan="3"');
    expect(mixed).toContain('>9,99,000<');
    expect(mixed).toContain('1,29,10,394'); // total open includes the booked INR of the USD row
  });

  it('puts the typed remarks in the table and marks the cells only for the pop-up', () => {
    const typed = summaryEmailHtml({ rows: ROWS, today: TODAY, liveUrl: 'u', signerName: 's', marks: true, remarks: { [ROWS[0]!.id]: 'Will pay <Friday>' } });
    expect(typed).toContain('Will pay &lt;Friday&gt;');
    expect(typed).toContain('data-remark');
    expect(html).not.toContain('data-remark');
  });

  it('builds the subject from the date', () => {
    expect(summaryEmailSubject(TODAY)).toBe('Receivables update - 3 November');
  });
});

describe('the security deposits section', () => {
  const DEPOSITS = {
    title: 'Security deposits',
    rows: [
      { client: 'Alpha Corp', status: 'LOI final stage', eta: 'week of 2nd', totalInr: 30000000, due: '100% due' },
      { client: 'Beta <script>alert(1)</script> Ltd', status: 'Agreement review', eta: 'week of 9th', totalInr: 20000000, due: 'Half now & half <b>later</b>' },
    ],
  };
  const base = { rows: ROWS, today: TODAY, liveUrl: 'u', signerName: 'Krishna' };

  it('leaves the email exactly as it was when there are no deposits', () => {
    const plain = summaryEmailHtml(base);
    expect(summaryEmailHtml({ ...base, deposits: null })).toBe(plain);
    expect(summaryEmailHtml({ ...base, deposits: { title: 'Security deposits', rows: [] } })).toBe(plain);
    expect(summaryEmailHtml({ ...base, marks: true, deposits: null })).toBe(summaryEmailHtml({ ...base, marks: true }));
    expect(plain).not.toContain('deposits');
  });

  it('adds its own heading, five columns, escaped rows and its own total after the receivables total', () => {
    const html = summaryEmailHtml({ ...base, deposits: DEPOSITS });
    for (const head of ['>Client<', '>Status<', '>ETA for closure<', '>Total SD (₹)<', '>SD due now / post signing<']) expect(html).toContain(head);
    expect(html).toContain('>Security deposits</p>');
    expect(html).toContain('>3,00,00,000<');
    expect(html).toContain('>2,00,00,000<');
    expect(html).toContain('>5,00,00,000<');
    expect(html).toContain('>5.00 cr<');
    expect(html).toContain('Beta &lt;script&gt;alert(1)&lt;/script&gt; Ltd');
    expect(html).toContain('Half now &amp; half &lt;b&gt;later&lt;/b&gt;');
    expect(html).not.toContain('<script>');
    const receivablesTotal = html.indexOf('Total receivables (open)');
    const section = html.indexOf('>Security deposits</p>');
    expect(receivablesTotal).toBeGreaterThan(0);
    expect(section).toBeGreaterThan(receivablesTotal);
    expect(section).toBeLessThan(html.indexOf('Regards,'));
    // The receivables total is unchanged by the deposits.
    expect(html).toContain('₹ 1,19,11,394');
  });

  it('is never drawn on a partner’s email', () => {
    const mine = summaryEmailHtml({ ...base, partnerSlug: 'sandeep', deposits: DEPOSITS });
    expect(mine).not.toContain('Alpha Corp');
    expect(mine).not.toContain('Security deposits');
    expect(mine).toBe(summaryEmailHtml({ ...base, partnerSlug: 'sandeep' }));
  });

  it('draws an empty amount as an empty cell', () => {
    const one = depositsSectionHtml({ title: 'SD', rows: [{ client: 'Gamma LLP', status: '', eta: '', totalInr: null, due: '' }] });
    expect(one).toMatch(/text-align:right;"><\/td>/);
    expect(one).toContain('>0.00 cr<');
  });

  it('swaps the marked block in place, and removes it when the rows are gone', () => {
    const marked = summaryEmailHtml({ ...base, marks: true, deposits: DEPOSITS });
    expect(marked).toContain('<!--deposits--><div data-deposits="" contenteditable="false">');
    const server = withDepositsSection(marked, depositsSectionHtml(DEPOSITS));
    expect(server).not.toContain('data-deposits');
    expect(server).toBe(summaryEmailHtml({ ...base, marks: true }).replace(/(<table[^>]*><tr><td[^>]*>Total receivables \(open\)[\s\S]*?<\/table>)/, `$1${depositsSectionHtml(DEPOSITS)}`));
    expect(withDepositsSection(marked, '')).toBe(summaryEmailHtml({ ...base, marks: true }));
    // A body without the block gets the section before "Regards,".
    const added = withDepositsSection('<p>Hi</p><p style="x">Regards,<br>K</p>', '<p>SD</p>');
    expect(added).toBe('<p>Hi</p><p>SD</p><p style="x">Regards,<br>K</p>');
    expect(withDepositsSection('<p>Hi</p>', '')).toBe('<p>Hi</p>');
  });
});
