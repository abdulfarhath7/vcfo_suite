import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { exportInBackground } from '@/lib/exports/background-export';
import {
  clientColumnOf,
  keepScopedRows,
  listSourceTable,
  normaliseName,
  scopedClientNameSet,
  type ListSource,
} from '@/lib/exports/list-sources';
import { tablesWorkbook, type ExportTable } from '@/lib/exports/table-xlsx';
import { standardDownloadName } from '@/lib/files/download-name';

const Cell = z.union([z.string().max(5000), z.number(), z.null()]);

const AuditSource = z.object({
  source: z.literal('audit-log'),
  engagementId: z.string().trim().max(80).optional().nullable(),
  filters: z.object({
    search: z.string().max(200).default(''),
    role: z.string().max(40).default('all'),
    category: z.string().max(40).default('all'),
  }),
});
const ApprovalsSource = z.object({
  source: z.literal('approvals'),
  scope: z.enum(['firm', 'manager']),
  kind: z.enum(['all', 'client', 'lead', 'send', 'board']),
});

const Body = z.object({
  /** The list's name, used for the sheet and the GL-08 file name ("Projects", "Audit log"). */
  title: z.string().trim().min(1).max(80),
  /** The client the list is about, when it is one client's list. */
  client: z.string().trim().max(160).optional().nullable(),
  /** A list the server reads itself (the audit log, the approvals inbox). */
  source: z.union([AuditSource, ApprovalsSource]).optional(),
  /** Otherwise the rows the list worked out in the browser, which the server scopes by client. */
  columns: z.array(z.string().max(120)).min(1).max(60).optional(),
  rows: z.array(z.array(Cell).max(60)).max(20000).optional(),
});

/**
 * POST /api/exports/xlsx (GL-06): a list as an .xlsx made in the background, with the rows that
 * match the filters on screen, in the list's order. Answers 202 at once; the bell, and a toast
 * while the person is still on the page, say when the file is ready.
 *
 * A list with a `source` (the audit log, the approvals inbox) is read here through the
 * repositories with the caller's `AuthContext`: every matching row, not only the pages loaded.
 * A list whose columns are worked out in the browser sends its rows; any row whose "Client"
 * column names a client outside the caller's scope is dropped, so a file never holds a client
 * its maker cannot see.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, Body);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { title, client, source, columns, rows } = body.data;
  if (!source && (!columns || !rows)) return NextResponse.json({ error: 'columns_and_rows_required' }, { status: 400 });

  const ctx = guard.ctx;
  // The file name carries the client only when the caller may see that client.
  const allowed = await scopedClientNameSet(ctx);
  const fileClient = client && allowed.has(normaliseName(client)) ? client : null;
  const fileName = standardDownloadName(title, fileClient, 'xlsx');

  const build = async (): Promise<Uint8Array> => {
    const table: ExportTable = source
      ? await listSourceTable(ctx, title, source as ListSource)
      : { sheet: title, columns: columns!, rows: keepScopedRows(rows!, clientColumnOf(columns!), allowed) };
    return tablesWorkbook([table]);
  };

  exportInBackground(ctx, {
    kind: 'table_xlsx',
    format: 'xlsx',
    fileName,
    label: `the Excel file of ${title}`,
    build,
  });
  return NextResponse.json({ queued: true, fileName }, { status: 202 });
}
