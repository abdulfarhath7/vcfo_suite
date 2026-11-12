'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export type ExcelCell = string | number | null | undefined;

/**
 * GL-06: the Excel export behind "Export to Excel" (`ExportToExcelButton`) and any menu item that
 * exports the same way. The file is made in the background; the bell says when it is ready.
 */
export interface ExcelExportInput {
  title: string;
  client?: string | null;
  columns: string[];
  /** Built on click, so a long list costs nothing until someone exports it. */
  rows: () => ExcelCell[][];
}

/** The export behind the button, for a menu item that exports the same way. */
export function useExcelExport({ title, client, columns, rows }: ExcelExportInput) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const data = rows().map((row) => row.map((cell) => (cell === undefined ? null : cell)));
      const res = await fetch('/api/exports/xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, client: client ?? null, columns, rows: data }),
      });
      if (!res.ok) throw new Error('export_failed');
      toast.success(`Making the Excel file of ${data.length} ${data.length === 1 ? 'row' : 'rows'}. You will get a notification when it is ready.`);
    } catch {
      toast.error('The export did not start. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return { start, busy };
}

