import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { ClientAuditError, listClientAuditEvents } from '@/db/repositories/client-audit';

/**
 * GET /api/client/audit/export?cat=Documents&who=sbc|client&q=text — CSV of the
 * filtered client-safe audit (no emails, no ids, no raw metadata).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(request.url);
  const cat = url.searchParams.get('cat') ?? '';
  const who = url.searchParams.get('who') ?? '';
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  try {
    const { events } = await listClientAuditEvents(guard.ctx, { limit: 2000 });
    const rows = events.filter(
      (e) =>
        (!cat || e.cat === cat) &&
        (!who || e.who.side === who) &&
        (!q || `${e.action} ${e.subject} ${e.who.name}`.toLowerCase().includes(q)),
    );
    const esc = (raw: string) => {
      // spreadsheet formula injection: a cell starting with = + - @ is text
      const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return /[",\n']/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const lines = [
      ['Date', 'Time (IST)', 'Type', 'What', 'Subject', 'Who', 'Role', 'Details'].join(','),
      ...rows.map((e) =>
        [e.day, e.time, e.cat, e.action, e.subject, e.who.name, e.who.role, e.facts.map((f) => `${f.k}: ${f.v}`).join(' · ')]
          .map(esc)
          .join(','),
      ),
    ];
    return new NextResponse(`﻿${lines.join('\n')}\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ClientAuditError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
