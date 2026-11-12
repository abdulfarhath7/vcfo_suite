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
} from '@/lib/exports/list-sources';
import { ListSourceSchema } from '@/lib/exports/list-source-schema';
import { tablesWorkbook, type ExportTable } from '@/lib/exports/table-xlsx';
import { standardDownloadName } from '@/lib/files/download-name';

const Cell = z.union([z.string().max(5000), z.number(), z.null()]);

/**
 * The one list that still sends its rows: the Directors grid, whose cells may hold answers the
 * person has typed but not saved. Every other list sends its filters (`source`), and a row
 * payload for it is refused.
 */
const BROWSER_ROW_LISTS: ReadonlySet<string> = new Set(['Directors']);

const Body = z.object({
  /** The list's name, used for the sheet and the GL-08 file name ("Projects", "Audit log"). */
  title: z.string().trim().min(1).max(80),
  /** The client the list is about, when it is one client's list. */
  client: z.string().trim().max(160).optional().nullable(),
  /** The list and the filters on screen; the server reads the rows itself. */
  source: ListSourceSchema.optional(),
  /** The Directors grid only: its rows as the browser holds them, which the server scopes by client. */
  columns: z.array(z.string().max(120)).min(1).max(60).optional(),
  rows: z.array(z.array(Cell).max(60)).max(20000).optional(),
});

/**
 * POST /api/exports/xlsx (GL-06): a list as an .xlsx made in the background, with the rows that
 * match the filters on screen, in the list's order. Answers 202 at once; the bell, and a toast
 * while the person is still on the page, say when the file is ready.
 *
 * Every list sends its `source`: its name and the filters and sort on screen, never its rows. The
 * rows are read here through the repositories with the caller's `AuthContext`: every matching
 * row, not only the pages loaded, and only what the role may see. Only the Directors grid sends
 * rows (`BROWSER_ROW_LISTS`); any of its rows whose "Client" column names a client outside the
 * caller's scope is dropped, so a file never holds a client its maker cannot see.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, Body);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { title, client, source, columns, rows } = body.data;
  if (!source && (!columns || !rows)) return NextResponse.json({ error: 'columns_and_rows_required' }, { status: 400 });
  if (!source && !BROWSER_ROW_LISTS.has(title)) return NextResponse.json({ error: 'source_required' }, { status: 400 });

  const ctx = guard.ctx;
  // The super admin's Clients reads the firm-wide overview, which only a super admin may read.
  if (source?.source === 'super-clients' && ctx.role !== 'super_admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  // The file name carries the client only when the caller may see that client.
  const allowed = await scopedClientNameSet(ctx);
  const fileClient = client && allowed.has(normaliseName(client)) ? client : null;
  const fileName = standardDownloadName(title, fileClient, 'xlsx');

  const build = async (): Promise<Uint8Array> => {
    const table: ExportTable = source
      ? await listSourceTable(ctx, title, source)
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
