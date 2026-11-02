import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/compliance/filings';
import {
  buildBook,
  cadenceOf,
  comingUp,
  countSt,
  fallbackLine,
  filterRows,
  moveDay,
  nextDeadline,
  parseStatus,
  periodMatrix,
  registerCsv,
  sbcRows,
  statusParam,
  winShort,
  worstOf,
} from './model';

const TODAY = '2026-10-29';

function eng(id: string, name: string, extra: Partial<Engagement> = {}): Engagement {
  return {
    id,
    clientId: `c-${id}`,
    companyName: name,
    companyType: 'domestic',
    internId: `lead-${id}`,
    adminId: 'a',
    createdAt: '2026-04-01T00:00:00Z',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    ...extra,
  } as Engagement;
}

function reg(id: string, engagementId: string, dueDate: string, extra: Partial<FilingRow> = {}): FilingRow {
  return {
    id,
    engagementId,
    companyName: 'Northwind Technologies Pvt Ltd',
    compliance: 'GST',
    particular: 'GSTR-3B Filing',
    authority: 'GST',
    frequency: 'monthly',
    dueDate,
    filedOn: null,
    periodLabel: null,
    fyLabel: 'FY 2026-27',
    rawStatus: 'upcoming',
    obligationId: 'gstr3b',
    windowFrom: null,
    windowTo: null,
    ...extra,
  };
}

const NW = eng('e1', 'Northwind Technologies Pvt Ltd', { incorporationDate: '2026-05-10', stage: 'Post-Incorporation' });
const OL = eng('e2', 'Orchid Lane Foods Pvt Ltd');

function book(register: FilingRow[], scope: 'all' | 'inc' | 'cmp' = 'all') {
  return buildBook({ today: TODAY, fy: 2026, scope, engagements: [NW, OL], stateFor: () => ({}), register, leads: [{ internId: 'lead-e1', name: 'Arjun Mehta' }] });
}

describe('buildBook', () => {
  it('register rows win; a client with no register rows gets SBC calendar lines', () => {
    const b = book([reg('r1', 'e1', '2026-10-20'), reg('r2', 'e1', '2026-11-20', { filedOn: '2026-11-18' })]);
    const nw = b.rows.filter((r) => r.clientId === 'e1');
    expect(nw).toHaveLength(2);
    expect(nw.every((r) => !r.cal)).toBe(true);
    expect(nw[0]!.st).toBe('o');
    expect(nw[1]!.st).toBe('f');
    const ol = b.rows.filter((r) => r.clientId === 'e2');
    expect(ol.length).toBeGreaterThan(0);
    expect(ol.every((r) => r.cal && r.st === 'c' && r.due >= TODAY)).toBe(true);
    expect(new Set(ol.map((r) => r.id)).size).toBe(ol.length);
    expect(b.fallback.map((c) => c.id)).toEqual(['e2']);
    expect(b.fallback[0]!.fallback).toBe('pre');
    expect(b.byId.e1!.leadName).toBe('Arjun Mehta');
  });

  it('follows the Stage filter and keeps register rows of a company off the roster', () => {
    const cmp = book([reg('r1', 'e1', '2026-10-20'), reg('r9', 'e9', '2026-10-25')], 'cmp');
    expect(cmp.clients.map((c) => c.id).sort()).toEqual(['e1', 'e9']);
    expect(cmp.rows.some((r) => r.clientId === 'e2')).toBe(false);
    const inc = book([reg('r1', 'e1', '2026-10-20')], 'inc');
    expect(inc.clients.map((c) => c.id)).toEqual(['e2']);
  });

  it('drops register rows outside the financial year', () => {
    const b = book([reg('r1', 'e1', '2027-04-20')]);
    expect(b.rows.some((r) => r.id === 'r1')).toBe(false);
  });
});

describe('filters and counts', () => {
  const b = book([reg('r1', 'e1', '2026-10-20'), reg('r2', 'e1', '2026-11-02'), reg('r3', 'e1', '2026-10-05', { filedOn: '2026-10-07', frequency: 'quarterly' })]);
  it('status params keep the live values', () => {
    expect(parseStatus('due-soon')).toBe('d');
    expect(parseStatus('filed')).toBe('f');
    expect(parseStatus('nonsense')).toBe('all');
    expect(statusParam('c')).toBe('calendar');
  });
  it('filters by company, status, cadence and month', () => {
    expect(filterRows(b.rows, { company: 'e1', status: 'f' }).map((r) => r.id)).toEqual(['r3']);
    expect(filterRows(b.rows, { company: 'e1', cadence: 'monthly', month: '2026-10' }).map((r) => r.id)).toEqual(['r1']);
    expect(countSt(filterRows(b.rows, { company: 'e1' }))).toMatchObject({ o: 1, d: 1, l: 1 });
  });
  it('next deadline prefers the register; coming up is the next 14 days', () => {
    expect(nextDeadline(b.rows, TODAY)?.id).toBe('r2');
    expect(comingUp(b.rows, TODAY).some((r) => r.id === 'r2')).toBe(true);
    expect(worstOf(['f', 'c', 'd'])).toBe('d');
  });
  it('cadence follows the live tabs', () => {
    expect(cadenceOf('half-yearly')).toBe('quarterly');
    expect(cadenceOf('one-time')).toBe('annual');
  });
});

describe('matrix, csv, words', () => {
  it('builds one matrix row per obligation and client', () => {
    const b = book([reg('r1', 'e1', '2026-10-20'), reg('r2', 'e1', '2026-11-20')]);
    const mx = periodMatrix(b.rows.filter((r) => !r.cal), ['2026-10', '2026-11'], (r) => r.due.slice(0, 7), true);
    expect(mx).toHaveLength(1);
    expect(mx[0]!.cells.map((c) => c?.id)).toEqual(['r1', 'r2']);
  });
  it('escapes csv cells and names the source', () => {
    const b = book([reg('r1', 'e1', '2026-10-20', { particular: '=HYPERLINK("x")' })]);
    const csv = registerCsv(b.rows.filter((r) => r.id === 'r1'));
    expect(csv.split('\r\n')[0]).toContain('Client');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('Register');
  });
  it('words', () => {
    expect(winShort({ from: '2026-10-01', to: '2026-10-20' }, TODAY)).toBe('1–20 Oct');
    expect(moveDay('2026-10-31', 'ArrowRight')).toBeNull();
    expect(moveDay('2026-10-08', 'ArrowUp')).toBe('2026-10-01');
    expect(moveDay('2026-10-08', 'End')).toBe('2026-10-31');
    const b = book([]);
    expect(fallbackLine(b.fallback, b.fyLabel)).toContain('Northwind and Orchid Lane have no filings');
  });
});

describe('SBC master calendar', () => {
  it('a picked company sees only what applies to it; a manager sees what applies to the book', () => {
    const foreign = eng('e3', 'Halcyon Payments India Pvt Ltd', { companyType: 'foreign' });
    const own = sbcRows({ today: TODAY, clients: [{ id: 'e1', e: NW }], company: 'e1' });
    expect(own.some((s) => s.act === 'FEMA')).toBe(false);
    const all = sbcRows({ today: TODAY, clients: [{ id: 'e1', e: NW }, { id: 'e3', e: foreign }] });
    expect(all.some((s) => s.act === 'FEMA' && s.clients.includes('e3'))).toBe(true);
    expect(all.some((s) => s.act === 'RERA')).toBe(false);
    expect(sbcRows({ today: TODAY, clients: [], firmWide: true }).some((s) => s.act === 'RERA')).toBe(true);
  });
});
