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
    const text = [
      'Client\tStatus\tETA for closure\tTotal SD in INR\tSD due now/post signing',
      'Alpha Corp\tLOI final stage\tweek of 2nd\t₹ 30,000,000\t100%, client asking for 25%',
      'Beta Ltd\tAgreement review\tweek of 9th\t2,00,00,000\t100% due',
      '\t\t\t₹ 50,000,000\t5cr',
    ].join('\r\n');
    const { rows, dropped } = parseDepositsPaste(text);
    expect(dropped).toBe(0);
    expect(rows).toEqual([
      { client: 'Alpha Corp', status: 'LOI final stage', eta: 'week of 2nd', amount: '₹ 30,000,000', due: '100%, client asking for 25%' },
      { client: 'Beta Ltd', status: 'Agreement review', eta: 'week of 9th', amount: '2,00,00,000', due: '100% due' },
    ]);
  });

  it('reads cells separated by two or more spaces, and a total row starting with "Total"', () => {
    const text = 'Client   Status   ETA   Total SD   Due\nGamma LLP  LOI final stage  week of 2nd  ₹ 10,000,000  100% due\nTotal      ₹ 10,000,000  1cr\n      ₹ 10,000,000   1cr';
    expect(parseDepositsPaste(text).rows).toEqual([{ client: 'Gamma LLP', status: 'LOI final stage', eta: 'week of 2nd', amount: '₹ 10,000,000', due: '100% due' }]);
  });

  it('reads a chat table with pipes, a "(total)" row and a rule row', () => {
    const text = '| Client | Status | ETA | Total SD | Due |\n|---|---|---|---|---|\n| Alpha Corp | LOI final stage | week of 2nd | ₹ 30,000,000 | 100% due |\n(total) | | | ₹ 30,000,000 | 3cr';
    expect(parseDepositsPaste(text).rows).toEqual([{ client: 'Alpha Corp', status: 'LOI final stage', eta: 'week of 2nd', amount: '₹ 30,000,000', due: '100% due' }]);
  });

  it('keeps a bad amount as text so the pop-up can mark it, and adds extra cells to the last column', () => {
    const { rows } = parseDepositsPaste('Delta Inc\tLOI\tsoon\t7.7cr\t100%\tsee note');
    expect(rows[0]).toEqual({ client: 'Delta Inc', status: 'LOI', eta: 'soon', amount: '7.7cr', due: '100% see note' });
    expect(amountProblem(rows[0]!.amount)).toBe(true);
  });

  it('keeps at most 50 rows and says how many were left out', () => {
    const text = Array.from({ length: 53 }, (_, i) => `Client ${i}\tS\tE\t100\tD`).join('\n');
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
    expect(depositsPayload('Security deposits', [{ client: '', status: ' ', eta: '', amount: '', due: '' }])).toBeNull();
    expect(depositsPayload('  ', [{ client: ' Alpha Corp ', status: 'LOI', eta: '', amount: '₹ 1,00,000', due: '100%' }, { client: '', status: '', eta: '', amount: '', due: '' }])).toEqual({
      title: 'Security deposits',
      rows: [{ client: 'Alpha Corp', status: 'LOI', eta: '', totalInr: 100000, due: '100%' }],
    });
  });
});
