'use client';

import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExcelExport, type ExcelExportInput } from '@/hooks/use-excel-export';

export type { ExcelCell } from '@/hooks/use-excel-export';

/**
 * GL-06: "Export to Excel", at the top right of a list. Pass every row that matches the list's
 * filters, in its sort order, not only the rows on screen. The file is made in the background;
 * the bell says when it is ready, with a Download link, and the GL-08 name.
 */
export function ExportToExcelButton({ className, ...input }: ExcelExportInput & { className?: string }) {
  const { start, busy } = useExcelExport(input);
  return (
    <Button type="button" size="sm" variant="outline" className={className} disabled={busy} onClick={start} data-testid="export-to-excel">
      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" aria-hidden />
      Export to Excel
    </Button>
  );
}
