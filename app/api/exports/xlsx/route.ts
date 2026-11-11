import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { exportInBackground } from '@/lib/exports/background-export';
import { tablesWorkbook } from '@/lib/exports/table-xlsx';
import { standardDownloadName } from '@/lib/files/download-name';

const Cell = z.union([z.string().max(5000), z.number(), z.null()]);
const Body = z.object({
  /** The list's name, used for the sheet and the GL-08 file name ("Projects", "Audit log"). */
  title: z.string().trim().min(1).max(80),
  /** The client the list is about, when it is one client's list. */
  client: z.string().trim().max(160).optional().nullable(),
  columns: z.array(z.string().max(120)).min(1).max(60),
  rows: z.array(z.array(Cell).max(60)).max(20000),
});

/**
 * POST /api/exports/xlsx (GL-06): the rows of a list, in the order and with the filters on screen,
 * as an .xlsx made in the background. The list sends every matching row, not only the page it
 * shows; the rows came from the same role-scoped API the list read, so a file never holds more
 * than its maker may see. Answers 202 at once; the bell says when the file is ready.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, Body);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { title, client, columns, rows } = body.data;
  const fileName = standardDownloadName(title, client ?? null, 'xlsx');
  exportInBackground(guard.ctx, {
    kind: 'table_xlsx',
    format: 'xlsx',
    fileName,
    label: `the Excel file of ${title}`,
    build: () => tablesWorkbook([{ sheet: title, columns, rows }]),
  });
  return NextResponse.json({ queued: true, fileName }, { status: 202 });
}
