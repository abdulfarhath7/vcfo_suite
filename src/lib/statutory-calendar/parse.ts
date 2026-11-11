import ExcelJS from 'exceljs';

import type { StatutoryAct, StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import { resolveAct, resolveAppliesTo } from './acts';
import { fyBounds } from './fy';
import { TEMPLATE_SHEET } from './template';

/**
 * STATUTORY CALENDAR IMPORT — reads the template (`template.ts`) back into deadlines for one
 * financial year, and lists every problem with its Excel row so the admin can fix the sheet.
 *
 * Columns are found by their header text, so a sheet whose columns were moved still imports. One
 * bad row fails the whole import: the caller publishes only when `errors` is empty. Rows that
 * repeat an earlier row exactly are dropped with a warning.
 */

export type ImportedDeadline = Omit<StatutoryDeadline, 'id'>;

export interface ImportIssue {
  /** 1-based Excel row; 0 when the problem is with the file itself. */
  row: number;
  column?: string;
  message: string;
}

export interface ParsedCalendar {
  deadlines: ImportedDeadline[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

type WorkbookInput = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

export const MAX_IMPORT_ROWS = 3000;
export const MAX_TITLE_LENGTH = 300;
export const MAX_NOTE_LENGTH = 500;

type Field = 'date' | 'act' | 'title' | 'scope' | 'note';

const HEADER_NAMES: Record<Field, readonly string[]> = {
  date: ['due date', 'date'],
  act: ['act'],
  title: ['compliance', 'compliance / form', 'compliance/form'],
  scope: ['applies to'],
  note: ['note', 'notes'],
};

const COLUMN_NAME: Record<Field, string> = {
  date: 'Due Date',
  act: 'Act',
  title: 'Compliance',
  scope: 'Applies To',
  note: 'Note',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim();
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return cellText((value.result ?? null) as ExcelJS.CellValue);
    return '';
  }
  return String(value).trim();
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function isoFromUtcMs(ms: number): string {
  return new Date(Math.round(ms / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

/** An ISO date from a date cell, an Excel serial number, or text such as 07-Apr-2027 or 07/04/2027. */
export function cellDate(value: ExcelJS.CellValue): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoFromUtcMs(value.getTime());
  if (typeof value === 'object' && 'result' in value) return cellDate((value.result ?? null) as ExcelJS.CellValue);
  if (typeof value === 'number') {
    return value > 0 && value < 100_000 ? isoFromUtcMs(EXCEL_EPOCH + value * DAY_MS) : null;
  }
  const text = cellText(value);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[\s./-]+([a-z]{3,9})[\s.,/-]+(\d{2}|\d{4})$/i.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? isoFromParts(Number(m[3]), month, Number(m[1])) : null;
  }
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (m) return isoFromParts(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function findHeader(sheet: ExcelJS.Worksheet): { row: number; columns: Partial<Record<Field, number>> } | null {
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const columns: Partial<Record<Field, number>> = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const name = cellText(cell.value).toLowerCase().replace(/\s+/g, ' ');
      for (const field of Object.keys(HEADER_NAMES) as Field[]) {
        if (columns[field] === undefined && HEADER_NAMES[field].includes(name)) columns[field] = col;
      }
    });
    if (columns.date !== undefined && columns.title !== undefined) return { row: r, columns };
  }
  return null;
}

function pickSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const named = workbook.worksheets.find((s) => s.name.trim().toLowerCase() === TEMPLATE_SHEET.toLowerCase());
  return named ?? workbook.worksheets.find((s) => findHeader(s) !== null) ?? workbook.worksheets[0];
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Reads the workbook for financial year `fyKey`. Never throws for a bad file; it reports it. */
export async function parseStatutoryCalendarWorkbook(input: ArrayBuffer | Uint8Array, fyKey: string): Promise<ParsedCalendar> {
  const fy = fyBounds(fyKey);
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const deadlines: (ImportedDeadline & { row: number })[] = [];

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(input as unknown as WorkbookInput);
  } catch {
    return { deadlines: [], warnings, errors: [{ row: 0, message: 'This file is not an Excel workbook. Save it as .xlsx and try again.' }] };
  }
  const sheet = pickSheet(workbook);
  const header = sheet ? findHeader(sheet) : null;
  if (!sheet || !header) {
    return {
      deadlines: [],
      warnings,
      errors: [{ row: 0, message: 'No header row with Due Date and Compliance was found. Start from the downloaded template.' }],
    };
  }
  for (const field of ['act'] as const) {
    if (header.columns[field] === undefined) {
      errors.push({ row: header.row, column: COLUMN_NAME[field], message: `The ${COLUMN_NAME[field]} column is missing.` });
    }
  }
  if (errors.length) return { deadlines: [], errors, warnings };

  const read = (row: ExcelJS.Row, field: Field): ExcelJS.CellValue => {
    const col = header.columns[field];
    return col === undefined ? null : row.getCell(col).value;
  };
  const seen = new Set<string>();

  for (let r = header.row + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw = {
      date: read(row, 'date'),
      act: cellText(read(row, 'act')),
      title: cellText(read(row, 'title')).replace(/\s+/g, ' '),
      scope: cellText(read(row, 'scope')),
      note: cellText(read(row, 'note')).replace(/\s+/g, ' '),
    };
    if (!cellText(raw.date) && !raw.act && !raw.title && !raw.scope && !raw.note) continue;
    if (deadlines.length + errors.length >= MAX_IMPORT_ROWS) {
      errors.push({ row: r, message: `A calendar can hold at most ${MAX_IMPORT_ROWS} deadlines.` });
      break;
    }

    const rowErrors: ImportIssue[] = [];
    const date = cellDate(raw.date);
    if (!cellText(raw.date)) rowErrors.push({ row: r, column: 'Due Date', message: 'Enter the due date.' });
    else if (!date) rowErrors.push({ row: r, column: 'Due Date', message: `"${cellText(raw.date)}" is not a date. Use a date such as 07-Apr-${fy.startYear + 1}.` });
    else if (date < fy.start || date > fy.end) {
      rowErrors.push({ row: r, column: 'Due Date', message: `${fmtDate(date)} is outside ${fy.label} (${fmtDate(fy.start)} to ${fmtDate(fy.end)}).` });
    }

    const act = raw.act ? resolveAct(raw.act) : null;
    if (!raw.act) rowErrors.push({ row: r, column: 'Act', message: 'Pick an Act from the list.' });
    else if (!act) rowErrors.push({ row: r, column: 'Act', message: `"${raw.act}" is not in the Act list.` });

    if (!raw.title) rowErrors.push({ row: r, column: 'Compliance', message: 'Enter the compliance or form name.' });
    else if (raw.title.length > MAX_TITLE_LENGTH) {
      rowErrors.push({ row: r, column: 'Compliance', message: `Keep it to ${MAX_TITLE_LENGTH} characters; it has ${raw.title.length}.` });
    }

    const scope = resolveAppliesTo(raw.scope);
    if (scope === null) rowErrors.push({ row: r, column: 'Applies To', message: `"${raw.scope}" is not All, Company or LLP.` });

    if (raw.note.length > MAX_NOTE_LENGTH) {
      rowErrors.push({ row: r, column: 'Note', message: `Keep it to ${MAX_NOTE_LENGTH} characters; it has ${raw.note.length}.` });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    const key = `${date}|${act!.act}|${act!.actLabel ?? ''}|${raw.title.toLowerCase()}`;
    if (seen.has(key)) {
      warnings.push({ row: r, message: 'Same date, Act and Compliance as an earlier row, so it was left out.' });
      continue;
    }
    seen.add(key);
    deadlines.push({
      row: r,
      date: date!,
      act: act!.act as StatutoryAct,
      ...(act!.actLabel ? { actLabel: act!.actLabel } : {}),
      title: raw.title,
      ...(scope ? { scope } : {}),
      ...(raw.note ? { note: raw.note } : {}),
    });
  }

  if (!errors.length && !deadlines.length) {
    errors.push({ row: header.row + 1, message: 'The Calendar sheet has no deadlines.' });
  }
  const ordered = deadlines
    .sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row)
    .map(({ row: _row, ...d }) => d);
  return { deadlines: errors.length ? [] : ordered, errors, warnings };
}

export interface CalendarSummary {
  total: number;
  months: { month: string; count: number }[];
  acts: { label: string; count: number }[];
}

/** Counts per month (in financial-year order) and per Act, for the import preview. */
export function summariseDeadlines(
  deadlines: readonly Pick<StatutoryDeadline, 'date' | 'act' | 'actLabel'>[],
  actLabel: (act: StatutoryAct) => string,
): CalendarSummary {
  const months = new Map<string, number>();
  const acts = new Map<string, number>();
  for (const d of deadlines) {
    const month = d.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    const label = d.actLabel ?? actLabel(d.act);
    acts.set(label, (acts.get(label) ?? 0) + 1);
  }
  return {
    total: deadlines.length,
    months: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    acts: [...acts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
  };
}
