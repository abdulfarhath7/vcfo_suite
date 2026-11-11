import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getStatutoryCalendar, replaceStatutoryCalendar } from '@/db/repositories/statutory-calendar';
import { ACT_META } from '@/data/statutory-calendar-fy2627';
import { canImportStatutoryCalendar } from '@/lib/statutory-calendar/access';
import { queueStatutoryCalendarAskSync } from '@/lib/statutory-calendar/ask-sync';
import { importableFyKeys, isFyKey, todayIsoInIndia } from '@/lib/statutory-calendar/fy';
import { parseStatutoryCalendarWorkbook, summariseDeadlines } from '@/lib/statutory-calendar/parse';
import type { StatutoryCalendarImportResponse } from '@/lib/statutory-calendar/types';
import { statutoryCalendarError } from '../_respond';

/** A calendar workbook is a few hundred rows; anything this size is not one. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/statutory-calendar/import — form fields `file` (.xlsx), `fy` ("2027-28") and `publish`
 * ("1" to save). Without `publish` it only checks the file and returns the preview. With it, a
 * clean file replaces the whole calendar for that year; a file with any error saves nothing (422).
 * Admin only.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canImportStatutoryCalendar(guard.ctx.role)) return NextResponse.json({ error: 'not permitted' }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const file = form.get('file');
  const fyKey = String(form.get('fy') ?? '');
  const publish = form.get('publish') === '1';
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an Excel file.' }, { status: 400 });
  if (!isFyKey(fyKey) || !importableFyKeys(todayIsoInIndia()).includes(fyKey)) {
    return NextResponse.json({ error: 'Pick a financial year from the list.' }, { status: 400 });
  }
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: 'Upload the template as an .xlsx file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'The file is larger than 5 MB, so it is not a calendar template.' }, { status: 400 });

  try {
    const parsed = await parseStatutoryCalendarWorkbook(await file.arrayBuffer(), fyKey);
    const current = await getStatutoryCalendar(guard.ctx, fyKey);
    const body: StatutoryCalendarImportResponse = {
      fy: current.fy,
      fileName: file.name,
      published: false,
      summary: summariseDeadlines(parsed.deadlines, (act) => ACT_META[act].label),
      errors: parsed.errors,
      warnings: parsed.warnings,
      replaces:
        current.source === 'none'
          ? null
          : {
              source: current.source,
              rowCount: current.deadlines.length,
              importedAt: current.imported?.importedAt ?? null,
              importedByName: current.imported?.importedByName ?? null,
            },
    };
    if (!publish) return NextResponse.json(body);
    if (parsed.errors.length) return NextResponse.json(body, { status: 422 });

    const saved = await replaceStatutoryCalendar(guard.ctx, fyKey, parsed.deadlines, { fileName: file.name });
    await recordAuditEvent(guard.ctx, {
      action: 'statutory_calendar.import',
      summary: `Imported the statutory calendar for ${saved.fy.label} (${saved.rowCount} deadlines)`,
      metadata: { fy: saved.fy.key, rowCount: saved.rowCount, replacedRowCount: saved.replacedRowCount, fileName: file.name },
    });
    queueStatutoryCalendarAskSync(saved.fy.key);
    return NextResponse.json({ ...body, published: true });
  } catch (err) {
    return statutoryCalendarError(err, 'import_failed');
  }
}
