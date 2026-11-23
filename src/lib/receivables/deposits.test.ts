import { describe, expect, it } from 'vitest';
import { amountProblem, croreLabel, depositsPayload, depositsTotal, depositsTotalLabel, parseAmountInr, parseDepositsPaste } from './deposits';

/** The security deposits section's paste and amount readers (owner, 23 Nov 2026). Invented names and amounts. */

describe('parseAmountInr', () => {
  it('reads rupee amounts with Indian or western grouping and a ₹, Rs or INR prefix', () => {
    expect(parseAmountInr('₹ 30,000,000')).toBe(30000000);
    expect(parseAmountInr('₹30,000,000')).toBe(30000000);
    expect(parseAmountInr('30000000')).toBe(30000000);
    expect(parseAmountInr('3,00,00,000')).toBe(30000000);
    expect(parseAmountInr('Rs. 20,000,000')).toBe(20000000);
    expect(parseAmountInr('Rs 20,00,000')).toBe(2000000);
    expect(parseAmountInr('INR 5,00,000')).toBe(500000);
    expect(parseAmountInr(' 1,250.50 ')).toBe(1250.5);
  });

  it('gives null for empty text and for text that is not an amount', () => {
    expect(parseAmountInr('')).toBeNull();
    expect(parseAmountInr('   ')).toBeNull();
    for (const bad of ['7.7cr', 'TBD', '-5', '12,,000', '1,000.', 'abc 100', '₹', '1e5', '99999999999999']) expect(parseAmountInr(bad)).toBeNull();
  });

  it('tells an empty cell from a bad one', () => {
    expect(amountProblem('')).toBe(false);
    expect(amountProblem('₹ 10,00,000')).toBe(false);
    expect(amountProblem('ten lakh')).toBe(true);
  });
});

describe('parseDepositsPaste', () => {
  it('reads a tab-separated table from Excel or Outlook and leaves out the header and total rows', () => {
    const text = ['Client\tAmount\tRemarks', 'Alpha Corp\t₹ 30,000,000\t100%, client asking for 25%', 'Beta Ltd\t2,00,00,000\t100% due', '\t₹ 50,000,000\t5cr'].join('\r\n');
    const { rows, dropped } = parseDepositsPaste(text);
    expect(dropped).toBe(0);
    expect(rows).toEqual([
      { client: 'Alpha Corp', amount: '₹ 30,000,000', remarks: '100%, client asking for 25%' },
      { client: 'Beta Ltd', amount: '2,00,00,000', remarks: '100% due' },
    ]);
  });

  it('reads cells separated by two or more spaces, and a total row starting with "Total"', () => {
    const text = 'Client   Amount   Remarks\nGamma LLP  ₹ 10,000,000  100% due\nTotal      ₹ 10,000,000  1cr\n      ₹ 10,000,000   1cr';
    expect(parseDepositsPaste(text).rows).toEqual([{ client: 'Gamma LLP', amount: '₹ 10,000,000', remarks: '100% due' }]);
  });

  it('reads a chat table with pipes, a "(total)" row and a rule row', () => {
    const text = '| Client | Amount | Remarks |\n|---|---|---|\n| Alpha Corp | ₹ 30,000,000 | 100% due |\n(total) | ₹ 30,000,000 | 3cr';
    expect(parseDepositsPaste(text).rows).toEqual([{ client: 'Alpha Corp', amount: '₹ 30,000,000', remarks: '100% due' }]);
  });

  it('keeps a bad amount as text so the pop-up can mark it, and adds extra cells to the remarks', () => {
    const { rows } = parseDepositsPaste('Delta Inc\t7.7cr\t100%\tsee note');
    expect(rows[0]).toEqual({ client: 'Delta Inc', amount: '7.7cr', remarks: '100% see note' });
    expect(amountProblem(rows[0]!.amount)).toBe(true);
  });

  it('keeps at most 50 rows and says how many were left out', () => {
    const text = Array.from({ length: 53 }, (_, i) => `Client ${i}\t100\tR`).join('\n');
    const { rows, dropped } = parseDepositsPaste(text);
    expect(rows).toHaveLength(50);
    expect(dropped).toBe(3);
  });
});

describe('totals and payload', () => {
  it('adds the filled amounts and gives the crore figure', () => {
    const total = depositsTotal([{ totalInr: 30000000 }, { totalInr: null }, { totalInr: 20000000 }]);
    expect(total).toBe(50000000);
    expect(croreLabel(77015232)).toBe('7.70 cr');
    expect(depositsTotalLabel(77015232)).toBe('₹ 7,70,15,232 (7.70 cr)');
  });

  it('builds the send payload: trimmed, empty rows out, amounts read, null when nothing is left', () => {
    expect(depositsPayload('Security deposits', [{ client: '', amount: '', remarks: ' ' }])).toBeNull();
    expect(depositsPayload('  ', [{ client: ' Alpha Corp ', amount: '₹ 1,00,000', remarks: '100%' }, { client: '', amount: '', remarks: '' }])).toEqual({
      title: 'Security deposits',
      rows: [{ client: 'Alpha Corp', totalInr: 100000, remarks: '100%' }],
    });
  });
});
