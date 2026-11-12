import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { ACT_META, STATUTORY_DEADLINES } from '@/data/statutory-calendar-fy2627';
import { cellDate, parseStatutoryCalendarWorkbook, summariseDeadlines } from './parse';
import { buildStatutoryCalendarWorkbook, TEMPLATE_HEADERS } from './template';
import { fyBounds, fyKeyForIso, importableFyKeys, isFyKey } from './fy';

async function sheetWith(rows: unknown[][], headers: readonly string[] = TEMPLATE_HEADERS): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Calendar');
  sheet.addRow([...headers]);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('financial years', () => {
  it('accepts only consecutive year pairs', () => {
    expect(isFyKey('2027-28')).toBe(true);
    expect(isFyKey('2099-00')).toBe(false);
    expect(isFyKey('2027-29')).toBe(false);
    expect(isFyKey('2027')).toBe(false);
  });

  it('places March in the year that started the April before', () => {
    expect(fyKeyForIso('2027-03-31')).toBe('2026-27');
    expect(fyKeyForIso('2027-04-01')).toBe('2027-28');
    expect(fyBounds('2027-28')).toMatchObject({ label: 'FY 2027-28', start: '2027-04-01', end: '2028-03-31' });
  });

  it('offers last year to two years ahead for import', () => {
    expect(importableFyKeys('2026-11-11')).toEqual(['2025-26', '2026-27', '2027-28', '2028-29']);
  });
});

describe('cellDate', () => {
  it('reads date cells, serial numbers and the usual typed forms', () => {
    expect(cellDate(d('2027-04-07'))).toBe('2027-04-07');
    expect(cellDate(46_484)).toBe('2027-04-07');
    expect(cellDate('07-Apr-2027')).toBe('2027-04-07');
    expect(cellDate('7 April 2027')).toBe('2027-04-07');
    expect(cellDate('07/04/2027')).toBe('2027-04-07');
    expect(cellDate('2027-04-07')).toBe('2027-04-07');
  });

  it('refuses impossible dates and other text', () => {
    expect(cellDate('31-Feb-2027')).toBeNull();
    expect(cellDate('next Monday')).toBeNull();
  });
});

describe('template round trip', () => {
  it('imports the built-in FY 2026-27 calendar unchanged after writing it to the template', async () => {
    const bytes = await buildStatutoryCalendarWorkbook(STATUTORY_DEADLINES);
    const parsed = await parseStatutoryCalendarWorkbook(bytes, '2026-27');
    expect(parsed.errors).toEqual([]);
    const strip = ({ id: _id, actLabel: _label, ...rest }: (typeof STATUTORY_DEADLINES)[number]) => rest;
    const expected = STATUTORY_DEADLINES.map(strip).sort((a, b) => a.date.localeCompare(b.date));
    // Rows that repeat an earlier one exactly are dropped, so compare against the de-duplicated list.
    const unique = expected.filter(
      (row, i) => expected.findIndex((o) => o.date === row.date && o.act === row.act && o.title.toLowerCase() === row.title.toLowerCase()) === i,
    );
    expect(parsed.deadlines.map(({ actLabel: _label, ...rest }) => rest)).toEqual(unique);
  });

  it('gives the blank template a header, dropdowns and an Instructions sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildStatutoryCalendarWorkbook()) as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet('Calendar')!;
    expect(sheet.getRow(1).values).toEqual([undefined, ...TEMPLATE_HEADERS]);
    expect(sheet.getCell('B2').dataValidation?.type).toBe('list');
    expect(sheet.getCell('D2').dataValidation?.formulae).toEqual(['"All,Company,LLP"']);
    expect(workbook.getWorksheet('Instructions')).toBeDefined();
    const parsed = await parseStatutoryCalendarWorkbook(await buildStatutoryCalendarWorkbook(), '2027-28');
    expect(parsed.errors[0]?.message).toMatch(/no deadlines/);
  });
});

describe('parseStatutoryCalendarWorkbook', () => {
  it('maps acts, Applies To and notes, and sorts by date', async () => {
    const bytes = await sheetWith([
      [d('2027-04-14'), 'TGRERA', 'Quarterly Progress Report Q4 FY 2026-27', '', ''],
      [d('2027-04-11'), 'gst', 'GSTR-1', 'All', 'Taxpayers having aggregate turnover more than INR 50 Mn'],
      ['30-May-2027', 'MCA', 'LLP Form 11 (FY 2026-27)', 'LLP', ''],
      [d('2027-10-31'), 'Transfer Pricing', 'TP Study Report, Form 3CEB', 'Company', ''],
    ]);
    const parsed = await parseStatutoryCalendarWorkbook(bytes, '2027-28');
    expect(parsed.errors).toEqual([]);
    expect(parsed.deadlines).toEqual([
      { date: '2027-04-11', act: 'GST', title: 'GSTR-1', note: 'Taxpayers having aggregate turnover more than INR 50 Mn' },
      { date: '2027-04-14', act: 'RERA', actLabel: 'TGRERA', title: 'Quarterly Progress Report Q4 FY 2026-27' },
      { date: '2027-05-30', act: 'MCA', title: 'LLP Form 11 (FY 2026-27)', scope: 'llp' },
      { date: '2027-10-31', act: 'TP', title: 'TP Study Report, Form 3CEB', scope: 'co' },
    ]);
  });

  it('reports every bad cell with its Excel row and saves nothing', async () => {
    const bytes = await sheetWith([
      [d('2027-04-07'), 'GST', 'GSTR-7', '', ''],
      [d('2026-04-07'), 'GST', 'Last year', '', ''],
      ['soon', 'SEBI', '', 'Firms', ''],
    ]);
    const parsed = await parseStatutoryCalendarWorkbook(bytes, '2027-28');
    expect(parsed.deadlines).toEqual([]);
    expect(parsed.errors.map((e) => [e.row, e.column])).toEqual([
      [3, 'Due Date'],
      [4, 'Due Date'],
      [4, 'Act'],
      [4, 'Compliance'],
      [4, 'Applies To'],
    ]);
    expect(parsed.errors[0].message).toContain('outside FY 2027-28');
  });

  it('skips blank rows, drops exact repeats with a warning, and finds moved columns by name', async () => {
    const bytes = await sheetWith(
      [
        ['GSTR-1', d('2027-05-11'), 'GST'],
        [],
        ['GSTR-1', d('2027-05-11'), 'GST'],
      ],
      ['Compliance', 'Due Date', 'Act'],
    );
    const parsed = await parseStatutoryCalendarWorkbook(bytes, '2027-28');
    expect(parsed.errors).toEqual([]);
    expect(parsed.deadlines).toHaveLength(1);
    expect(parsed.warnings).toEqual([{ row: 4, message: expect.stringContaining('earlier row') }]);
  });

  it('refuses a file that is not a workbook, and a sheet without the header', async () => {
    expect((await parseStatutoryCalendarWorkbook(Buffer.from('not excel'), '2027-28')).errors[0].message).toMatch(/not an Excel workbook/);
    const bytes = await sheetWith([[d('2027-04-07'), 'GST']], ['When', 'What']);
    expect((await parseStatutoryCalendarWorkbook(bytes, '2027-28')).errors[0].message).toMatch(/No header row/);
  });
});

describe('summariseDeadlines', () => {
  it('counts per month in date order and per act label', () => {
    const summary = summariseDeadlines(
      [
        { date: '2027-05-01', act: 'GST' },
        { date: '2027-04-07', act: 'RERA', actLabel: 'APRERA' },
        { date: '2027-04-11', act: 'GST' },
      ],
      (act) => ACT_META[act].label,
    );
    expect(summary).toEqual({
      total: 3,
      months: [
        { month: '2027-04', count: 2 },
        { month: '2027-05', count: 1 },
      ],
      acts: [
        { label: 'GST', count: 2 },
        { label: 'APRERA', count: 1 },
      ],
    });
  });
});

describe('statutoryArea', () => {
  it('uses the filings register area names, and keeps the act for the rest', async () => {
    const { statutoryArea } = await import('./acts');
    expect(statutoryArea({ act: 'IT' })).toBe('Income Tax');
    expect(statutoryArea({ act: 'MCA' })).toBe('Companies Act, 2013');
    expect(statutoryArea({ act: 'MCA', scope: 'llp' })).toBe('LLP Act');
    expect(statutoryArea({ act: 'STPI/SEZ' })).toBe('STPI/SEZ');
  });
});
