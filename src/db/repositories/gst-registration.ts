import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceSubjectFields, engagements } from '@/db/schema';
import { getItem } from '@/data/checklist';
import type { EngagementDbRow } from '@/db/repositories/engagements';
import { isIncorporated, type IncorporationChecklistState } from '@/lib/compliance/incorporation-state';
import { normalizeEngagementSchedule } from '@/lib/projects/schedule-windows';
import { GST_FIELD, GST_STEP_ID, gstDueToday, gstSchedule, type GstSchedule } from '@/lib/registrations/gst-tracker';

/**
 * GST REGISTRATION — system reads for the daily start reminder
 * (`src/jobs/gst-registration-start.ts`). No user context: the job runs as the system and
 * only reads which engagements start GST registration today. Who is told is decided by
 * the people lookup the job uses.
 */

export interface GstStartDue {
  engagement: EngagementDbRow;
  schedule: GstSchedule;
}

/**
 * Engagements whose GST registration is scheduled on the firm calendar for today and has no
 * ARN yet. An engagement that is not incorporated (`isIncorporated`) is skipped: before the
 * Certificate of Incorporation a planned reg-4 window is not due and nobody is reminded.
 */
export async function systemGstDueToday(today: string): Promise<GstStartDue[]> {
  const item = getItem(GST_STEP_ID);
  if (!item) return [];
  const rows = await db.select().from(engagements);
  const candidates = rows
    .map((engagement) => {
      const state = engagement.checklistState as IncorporationChecklistState | null;
      const step = state?.[GST_STEP_ID];
      if (step?.status === 'completed' || step?.status === 'not-applicable') return null;
      const incorporationDate = engagement.incorporationDate ? String(engagement.incorporationDate).slice(0, 10) : null;
      const schedule = gstSchedule({
        schedule: normalizeEngagementSchedule(engagement.schedule),
        incorporationDate,
        rule: item.deadline,
        incorporated: isIncorporated({ incorporationDate, stage: engagement.stage }, state),
      });
      return schedule.source === 'calendar' && schedule.date === today ? { engagement, schedule } : null;
    })
    .filter((x): x is GstStartDue => x !== null);
  if (!candidates.length) return [];

  const filed = await db
    .select({ engagementId: complianceSubjectFields.engagementId, value: complianceSubjectFields.value })
    .from(complianceSubjectFields)
    .where(
      and(
        inArray(complianceSubjectFields.engagementId, candidates.map((c) => c.engagement.id)),
        eq(complianceSubjectFields.subjectKind, 'registration'),
        eq(complianceSubjectFields.subjectKey, GST_STEP_ID),
        eq(complianceSubjectFields.fieldKey, GST_FIELD.arn),
      ),
    );
  const arnBy = new Map(filed.map((f) => [f.engagementId, f.value]));
  return candidates.filter((c) => gstDueToday(c.schedule, { [GST_FIELD.arn]: arnBy.get(c.engagement.id) ?? null }, today));
}
