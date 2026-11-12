import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { auditLogExportRows, normaliseName, scopedClientNameSet } from '@/lib/exports/list-sources';
import { recordExport } from '@/lib/exports/record-export';
import { standardDownloadName } from '@/lib/files/download-name';
import type { AuditFilters } from '@/views/admin/audit-log/audit-filters';
import { auditRowsCsv } from '@/views/admin/audit-log/audit-csv';

/** A query parameter, trimmed and cut to `max` characters. */
function param(p: URLSearchParams, name: string, max: number, fallback = ''): string {
  return (p.get(name) ?? fallback).trim().slice(0, max) || fallback;
}

/**
 * GET /api/exports/audit-log?engagementId=&search=&role=&category=&name=&client= — the audit log
 * as CSV (P-373). The rows come from the same server source as the Excel export
 * (`auditLogExportRows`): every event the filters keep, read page by page with the caller's
 * `AuthContext`, not only the pages the browser has loaded. The file is logged and kept for 30
 * days, and its name follows GL-08 (with the client only when the caller may see that client).
 * Staff only.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const filters = {
    search: param(p, 'search', 200),
    role: param(p, 'role', 40, 'all'),
    category: param(p, 'category', 40, 'all'),
  } as AuditFilters;
  const engagementId = param(p, 'engagementId', 80) || null;
  const client = param(p, 'client', 160) || null;

  const ctx = guard.ctx;
  const [rows, allowed] = await Promise.all([auditLogExportRows(ctx, { engagementId, filters }), scopedClientNameSet(ctx)]);
  const fileClient = client && allowed.has(normaliseName(client)) ? client : null;
  // Always a .csv, whatever the name asked for.
  const fileName = standardDownloadName(param(p, 'name', 120, 'audit-log').replace(/\.[a-z0-9]+$/i, ''), fileClient, 'csv');
  const csv = auditRowsCsv(rows);
  await recordExport(ctx, { kind: 'audit_log', format: 'csv', fileName, body: csv });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
