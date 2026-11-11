'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

export type ExcelCell = string | number | null | undefined;

/**
 * GL-06: "Export to Excel", at the top right of a list. Pass every row that matches the list's
 * filters, in its sort order, not only the rows on screen. The file is made in the background;
 * the bell says when it is ready, with a Download link, and the GL-08 name.
 */
export function ExportToExcelButton({
  title,
  client,
  columns,
  rows,
  className,
}: {
  title: string;
  client?: string | null;
  columns: string[];
  /** Built on click, so a long list costs nothing until someone exports it. */
  rows: () => ExcelCell[][];
  className?: string;
}) {
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
  return (
    <Button type="button" size="sm" variant="outline" className={className} disabled={busy} onClick={start} data-testid="export-to-excel">
      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" aria-hidden />
      Export to Excel
    </Button>
  );
}
