import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertReadOnlyRequest } from '../src/guard';
import {
  buildCompanyRequest,
  buildVoucherRequest,
  mapCompanyName,
  mapVouchers,
  parseAmount,
  sanitizeTallyXml,
} from '../src/tally';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('mapVouchers', () => {
  it('maps a sales voucher with GSTIN, party amount and bill reference', () => {
    const [first] = mapVouchers(fixture('sales.xml'));
    expect(first).toEqual({
      guid: 'a1b2c3d4-0001-0001-0001-000000000001-00000011',
      voucherType: 'Sales GST',
      voucherNo: 'SI/26-27/001',
      date: '2026-04-05',
      partyName: 'Acme Traders & Co',
      gstin: '29ABCDE1234F1Z5',
      amount: 118000,
      bills: [{ name: 'SI/26-27/001', amount: 118000 }],
    });
  });

  it('skips cancelled vouchers and sanitises bad characters', () => {
    const vouchers = mapVouchers(fixture('sales.xml'));
    expect(vouchers.map((v) => v.voucherNo)).toEqual(['SI/26-27/001', 'SI/26-27/002']);
    const second = vouchers[1];
    expect(second.partyName).toBe('BadChars Ltd');
    expect(second.gstin).toBeNull();
    expect(second.amount).toBe(5900);
    expect(second.bills).toBeUndefined();
  });

  it('maps a receipt with two bill allocations and drops dates outside the range', () => {
    const vouchers = mapVouchers(fixture('receipts.xml'), { from: '2026-04-01', to: '2026-04-30' });
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]).toMatchObject({
      voucherType: 'Receipt',
      voucherNo: '7',
      date: '2026-04-20',
      partyName: 'Acme Traders & Co',
      amount: 50000,
      bills: [
        { name: 'SI/26-27/001', amount: 30000 },
        { name: 'SI/25-26/118', amount: 20000 },
      ],
    });
  });

  it('reports a Tally LINEERROR instead of returning nothing', () => {
    expect(() => mapVouchers('<ENVELOPE><LINEERROR>Could not find Company</LINEERROR></ENVELOPE>')).toThrow(
      /Could not find Company/,
    );
  });
});

describe('sanitizeTallyXml', () => {
  it('removes invalid character references and raw control characters, keeps valid ones', () => {
    expect(sanitizeTallyXml('a&#4;b&#x1F;c&#0;d\u0007e&#13;&#10;&#65;&amp;')).toBe('abcde&#13;&#10;&#65;&amp;');
  });
});

describe('parseAmount', () => {
  it('reads Indian grouping, signs and forex suffixes as positive rupees', () => {
    expect(parseAmount('-1,18,000.00')).toBe(118000);
    expect(parseAmount('-100.50 USD @ ₹ 83.00/USD')).toBe(100.5);
    expect(parseAmount('')).toBeNull();
  });
});

describe('company info', () => {
  it('picks the current company', () => {
    expect(mapCompanyName(fixture('companies.xml'))).toBe('Summit Enterprises');
  });
});

describe('requests', () => {
  it('builds export-only requests that pass the write guard', () => {
    const sales = buildVoucherRequest('sales', '2026-04-01', '2026-04-30', 'Summit & Co');
    expect(sales).toContain('<SVFROMDATE TYPE="Date">20260401</SVFROMDATE>');
    expect(sales).toContain('<SVTODATE TYPE="Date">20260430</SVTODATE>');
    expect(sales).toContain('$$IsSales:$VoucherTypeName');
    expect(sales).toContain('Summit &amp; Co');
    expect(buildVoucherRequest('receipts', '2026-04-01', '2026-04-30')).toContain('$$IsReceipt:$VoucherTypeName');
    expect(() => assertReadOnlyRequest(sales)).not.toThrow();
    expect(() => assertReadOnlyRequest(buildCompanyRequest())).not.toThrow();
  });
});
