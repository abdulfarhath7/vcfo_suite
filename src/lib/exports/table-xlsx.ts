import ExcelJS from 'exceljs';

export type TableCell = string | number | null;

export interface ExportTable {
  /** The sheet name (Excel allows 31 characters). */
  sheet: string;
  columns: string[];
  rows: TableCell[][];
}

/**
 * GL-06: one or more tables as an .xlsx, header row bold and frozen, columns sized to their
 * content. Shared by the list exports and the project ZIP's spreadsheets.
 */
export async function tablesWorkbook(tables: ExportTable[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCFO Suite';
  const used = new Set<string>();
  for (const table of tables) {
    let name = table.sheet.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${name.slice(0, 28)} ${n}`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(table.columns).font = { bold: true };
    for (const row of table.rows) ws.addRow(row.map((cell) => (cell === null ? '' : cell)));
    ws.columns.forEach((col, i) => {
      const longest = Math.max(table.columns[i]?.length ?? 8, ...table.rows.slice(0, 500).map((r) => String(r[i] ?? '').length));
      col.width = Math.min(60, Math.max(10, longest + 2));
    });
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
