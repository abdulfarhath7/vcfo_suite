import ExcelJS from 'exceljs';

import type { StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import { ACT_OPTIONS, APPLIES_TO_OPTIONS, templateActLabel, templateAppliesTo } from './acts';

/**
 * STATUTORY CALENDAR TEMPLATE — the workbook an admin downloads, fills in and imports.
 *
 * It looks like an ordinary Excel file on purpose: Calibri 11, Excel's own gridlines, one bold
 * header row with a light fill and filter buttons, frozen under the header. The Calendar sheet has
 * the five columns the parser reads (`parse.ts`); the Instructions sheet repeats the rules. Given
 * deadlines, it fills the Calendar sheet with them, so an admin can start next year from this one.
 */

export const TEMPLATE_SHEET = 'Calendar';
export const TEMPLATE_HEADERS = ['Due Date', 'Act', 'Compliance', 'Applies To', 'Note'] as const;

/** Rows that carry the dropdowns and date check, beyond any rows already filled in. */
const VALIDATED_ROWS = 1500;
const HEADER_FILL = 'FFD9E1F2';
const DATE_FORMAT = 'dd-mmm-yyyy';
const FONT = { name: 'Calibri', size: 11 } as const;

type ValidationSheet = { dataValidations: { add(address: string, validation: ExcelJS.DataValidation): void } };

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addCalendarSheet(workbook: ExcelJS.Workbook, deadlines: readonly StatutoryDeadline[]) {
  const sheet = workbook.addWorksheet(TEMPLATE_SHEET, {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
  });
  sheet.columns = [
    { key: 'date', width: 14 },
    { key: 'act', width: 20 },
    { key: 'title', width: 62 },
    { key: 'scope', width: 13 },
    { key: 'note', width: 48 },
  ];

  const header = sheet.getRow(1);
  header.values = [...TEMPLATE_HEADERS];
  header.eachCell((cell) => {
    cell.font = { ...FONT, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFA6A6A6' } } };
    cell.alignment = { vertical: 'middle' };
  });
  sheet.autoFilter = 'A1:E1';

  deadlines.forEach((d, i) => {
    const row = sheet.getRow(i + 2);
    row.values = [utcDate(d.date), templateActLabel(d), d.title, templateAppliesTo(d.scope), d.note ?? ''];
  });

  const last = Math.max(deadlines.length + 1, VALIDATED_ROWS);
  sheet.getColumn(1).numFmt = DATE_FORMAT;
  sheet.getColumn(1).alignment = { horizontal: 'right', vertical: 'top' };
  for (const col of [2, 3, 4, 5]) sheet.getColumn(col).alignment = { vertical: 'top', wrapText: col === 3 || col === 5 };
  header.alignment = { vertical: 'middle' };

  const validations = (sheet as unknown as ValidationSheet).dataValidations;
  validations.add(`A2:A${last}`, {
    type: 'date',
    operator: 'greaterThan',
    allowBlank: true,
    formulae: [new Date(Date.UTC(2000, 0, 1))],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Due Date',
    error: 'Enter a date, for example 07-Apr-2027.',
  });
  validations.add(`B2:B${last}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${ACT_OPTIONS.map((o) => o.label).join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Act',
    error: 'Pick an Act from the list.',
  });
  validations.add(`D2:D${last}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${APPLIES_TO_OPTIONS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Applies To',
    error: 'Pick All, Company or LLP.',
  });
}

const INSTRUCTIONS: readonly [string, string][] = [
  ['How to use this file', ''],
  ['1', 'Fill one row on the Calendar sheet for each deadline. Leave no blank rows between deadlines.'],
  ['2', 'In VCFO Suite, open Compliances, then Calendar, and choose Import calendar.'],
  ['3', 'Pick the financial year the file is for, choose this file, and check it. Fix any rows the app lists, then publish.'],
  ['4', 'Publishing replaces the whole calendar for that financial year.'],
  ['', ''],
  ['Column', 'What goes in it'],
  ['Due Date', 'Required. A date inside the financial year you pick at import (1 April to 31 March), for example 07-Apr-2027.'],
  ['Act', `Required. One of: ${ACT_OPTIONS.map((o) => o.label).join(', ')}.`],
  ['Compliance', 'Required. The form or filing name, as it should appear on the calendar. Up to 300 characters.'],
  ['Applies To', 'Optional. All, Company or LLP. Blank means All, except that an MCA row left blank is treated as Company.'],
  ['Note', 'Optional. The footnote for this line, written out in full, for example "Taxpayers having aggregate turnover more than INR 50 Mn".'],
  ['', ''],
  ['Not in this file', 'The financial year (picked at import), month headings, and the highlighted calendar grid. The app works these out from the dates.'],
];

function addInstructionsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instructions');
  sheet.columns = [{ width: 18 }, { width: 110 }];
  INSTRUCTIONS.forEach(([a, b], i) => {
    const row = sheet.getRow(i + 1);
    row.values = [a, b];
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(1).alignment = { vertical: 'top' };
  });
  sheet.getRow(1).font = { ...FONT, bold: true, size: 14 };
  const head = sheet.getRow(7);
  head.font = { ...FONT, bold: true };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });
  for (let r = 8; r <= 12; r++) sheet.getRow(r).getCell(1).font = { ...FONT, bold: true };
  sheet.getRow(14).getCell(1).font = { ...FONT, bold: true };
}

/** The template as .xlsx bytes, filled with `deadlines` when given. */
export async function buildStatutoryCalendarWorkbook(
  deadlines: readonly StatutoryDeadline[] = [],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VCFO Suite';
  workbook.created = new Date();
  addCalendarSheet(workbook, deadlines);
  addInstructionsSheet(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function statutoryCalendarFileName(fyLabel?: string): string {
  return fyLabel ? `SBC Statutory Calendar ${fyLabel}.xlsx` : 'SBC Statutory Calendar Template.xlsx';
}
