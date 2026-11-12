'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useExportReadyToast } from '@/hooks/use-export-ready-toast';
import type { ListSourceInput } from '@/lib/exports/list-source-schema';

export type ExcelCell = string | number | null | undefined;

/** A list the server reads itself, with the viewer's scope: its name and the filters on screen (GL-06). */
export type ExcelExportSource = ListSourceInput;

/**
 * GL-06: the Excel export behind "Export to Excel" (`ExportToExcelButton`) and any menu item that
 * exports the same way. The file is made in the background; the bell says when it is ready, and
 * a toast says so too while this page is still open.
 *
 * Pass `source`: the list and the filters and sort on screen. The server reads every matching
 * row itself, with the viewer's scope. Only the Directors grid passes `columns` and `rows`, since
 * its cells may hold answers not yet saved; the server refuses rows from any other list and drops
 * any row whose "Client" column names a client the viewer cannot see.
 */
export type ExcelExportInput = {
  title: string;
  client?: string | null;
} & (
  | { source: ExcelExportSource; columns?: undefined; rows?: undefined }
  | {
      source?: undefined;
      columns: string[];
      /** Built on click, so a long list costs nothing until someone exports it. */
      rows: () => ExcelCell[][];
    }
);

/** The export behind the button, for a menu item that exports the same way. */
export function useExcelExport(input: ExcelExportInput) {
  const [busy, setBusy] = useState(false);
  const watch = useExportReadyToast();
  const start = async () => {
    setBusy(true);
    try {
      const { title, client } = input;
      const payload = input.source
        ? { title, client: client ?? null, source: input.source }
        : { title, client: client ?? null, columns: input.columns, rows: input.rows().map((row) => row.map((cell) => (cell === undefined ? null : cell))) };
      const res = await fetch('/api/exports/xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('export_failed');
      const { fileName } = (await res.json().catch(() => ({}))) as { fileName?: string };
      if (fileName) watch(fileName);
      const count = 'rows' in payload && payload.rows ? ` of ${payload.rows.length} ${payload.rows.length === 1 ? 'row' : 'rows'}` : '';
      toast.success(`Making the Excel file${count}. You will get a notification when it is ready.`);
    } catch {
      toast.error('The export did not start. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return { start, busy };
}
