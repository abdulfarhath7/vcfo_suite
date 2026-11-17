import ExcelJS from 'exceljs';
import { dateOf, text, type WorkbookInput } from './import-workbook';

/**
 * RECEIVABLES v2 — reads a Tally "Sales Register" export (docs/specs/receivables/V2.md). Pure: it
 * takes the file's bytes and returns rows; nothing is stored here.
 *
 * The file:
 *  - is `.xlsx` inside even when it is named `.xls`. A real legacy BIFF `.xls` is refused with the
 *    code `not_xlsx` ("Export from Tally as Excel (.xlsx)").
 *  - opens with a header block (company name, addresses, GSTINs, "Sales Register", the period such
 *    as "1-Apr-26 to 31-Mar-27"). The column row is the one holding "Voucher No."; its position
 *    changes with the address lines, so it is searched for, never assumed.
 *  - has the fixed columns Date, Particulars, Buyer, Consignee, Voucher Type, Voucher No.,
 *    GSTIN/UIN, PAN No., Value and Gross Total, followed by any number of ledger columns (fees, GST,
 *    TDS, reimbursements) that change between exports. The ledger columns are ignored.
 *  - ends with a "Grand Total" row, which is skipped, as is every row whose Voucher Type is not
 *    "Sales".
 *
 * Mapping: client = Buyer, else Particulars; invoice date = Date; invoice no. = Voucher No. exactly
 * as written; amount = Gross Total in INR (foreign clients too: Tally's INR is kept); GSTIN =
 * GSTIN/UIN (often blank).
 */

export type TallyRow = {
  invoiceNo: string;
  /** `voucherKey(invoiceNo)`, the matching key. */
  invoiceKey: string;
  invoiceDate: string;
  clientName: string;
  gstin: string | null;
  amountInr: number;
  /** 1-based row in the worksheet, for warnings. */
  sourceRow: number;
};

export type TallySalesRegister = {
  company: string;
  period: string;
  rows: TallyRow[];
  warnings: string[];
};

export class TallyImportError extends Error {
  constructor(readonly code: 'not_xlsx' | 'not_sales_register' | 'no_rows') {
    super(code);
  }
}

/**
 * The matching key of a voucher number: upper case, spaces removed, and leading zeros dropped in
 * each run of digits, so `SCSPL/26-27/0164` and `scspl/26-27/164` are the same invoice.
 */
export function voucherKey(invoiceNo: string): string {
  return invoiceNo
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\d+/g, (d) => d.replace(/^0+(?=\d)/, ''));
}

/** A zip archive (every .xlsx) starts with "PK\x03\x04"; an old BIFF .xls is an OLE file (D0 CF 11 E0). */
function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Header text compared without case, dots or spaces: "Voucher No." → "voucherno". */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const COLUMNS = {
  date: ['date'],
  particulars: ['particulars'],
  buyer: ['buyer', 'buyername'],
  voucherType: ['vouchertype'],
  voucherNo: ['voucherno', 'vouchernumber'],
  gstin: ['gstinuin', 'gstin'],
  grossTotal: ['grosstotal'],
} as const;

type ColumnKey = keyof typeof COLUMNS;

function amountOf(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'result' in v && typeof v.result === 'number') return v.result;
  const s = text(v).replace(/[,₹\s]/g, '').replace(/\(([\d.]+)\)/, '-$1');
  if (!s) return null;
  const n = Number(s.replace(/(Dr|Cr)$/i, ''));
  return Number.isFinite(n) ? n : null;
}

const PERIOD = /\d{1,2}-[A-Za-z]{3}-\d{2,4}\s+to\s+\d{1,2}-[A-Za-z]{3}-\d{2,4}/i;

/** Reads the register. Throws `TallyImportError` when the file is not a Tally Sales Register in xlsx. */
export async function parseTallySalesRegister(input: Uint8Array | ArrayBuffer): Promise<TallySalesRegister> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isZip(bytes)) throw new TallyImportError('not_xlsx');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as WorkbookInput);
  } catch {
    throw new TallyImportError('not_xlsx');
  }

  for (const ws of wb.worksheets) {
    // Find the column row by its "Voucher No." cell, within the first 60 rows.
    let headerRow = 0;
    const col: Partial<Record<ColumnKey, number>> = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 60) && !headerRow; r++) {
      const row = ws.getRow(r);
      const found: Partial<Record<ColumnKey, number>> = {};
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        const h = norm(text(cell.value));
        for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
          if (found[key] === undefined && (COLUMNS[key] as readonly string[]).includes(h)) found[key] = c;
        }
      });
      if (found.voucherNo !== undefined) {
        headerRow = r;
        Object.assign(col, found);
      }
    }
    if (!headerRow) continue;
    if (col.date === undefined || col.grossTotal === undefined || (col.buyer === undefined && col.particulars === undefined)) {
      throw new TallyImportError('not_sales_register');
    }

    // The header block: the first non-empty text is the company; a "d-Mon-yy to d-Mon-yy" cell is the period.
    let company = '';
    let period = '';
    for (let r = 1; r < headerRow; r++) {
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        const t = text(cell.value).trim();
        if (!t) return;
        if (!company) company = t;
        const m = t.match(PERIOD);
        if (m && !period) period = m[0];
      });
    }

    const rows: TallyRow[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let skippedType = 0;
    const cell = (r: ExcelJS.Row, c: number | undefined) => (c === undefined ? null : r.getCell(c).value);
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const particulars = text(cell(row, col.particulars)).trim();
      if (/^grand\s*total$/i.test(particulars)) break;
      const voucherNo = text(cell(row, col.voucherNo)).trim();
      const buyer = text(cell(row, col.buyer)).trim();
      if (!voucherNo && !particulars && !buyer) continue;
      if (col.voucherType !== undefined) {
        const type = text(cell(row, col.voucherType)).trim();
        if (type.toLowerCase() !== 'sales') {
          skippedType += 1;
          continue;
        }
      }
      if (!voucherNo) {
        warnings.push(`Row ${r}: no voucher number; skipped.`);
        continue;
      }
      const invoiceDate = dateOf(cell(row, col.date));
      if (!invoiceDate) {
        warnings.push(`Row ${r} (${voucherNo}): no date; skipped.`);
        continue;
      }
      const amount = amountOf(cell(row, col.grossTotal));
      if (amount === null || amount <= 0) {
        warnings.push(`Row ${r} (${voucherNo}): no gross total above zero; skipped.`);
        continue;
      }
      const clientName = (buyer || particulars).replace(/\s+/g, ' ').slice(0, 120);
      if (!clientName) {
        warnings.push(`Row ${r} (${voucherNo}): no buyer or particulars; skipped.`);
        continue;
      }
      const invoiceKey = voucherKey(voucherNo);
      if (seen.has(invoiceKey)) {
        warnings.push(`Row ${r} (${voucherNo}): the same voucher number appears twice; the first was kept.`);
        continue;
      }
      seen.add(invoiceKey);
      const gstin = text(cell(row, col.gstin)).trim().toUpperCase();
      rows.push({
        invoiceNo: voucherNo.slice(0, 40),
        invoiceKey,
        invoiceDate,
        clientName,
        gstin: gstin || null,
        amountInr: Math.round(amount * 100) / 100,
        sourceRow: r,
      });
    }
    if (skippedType) warnings.push(`${skippedType} row(s) with a voucher type other than Sales were skipped.`);
    if (!rows.length) throw new TallyImportError('no_rows');
    return { company, period, rows, warnings };
  }
  throw new TallyImportError('not_sales_register');
}
