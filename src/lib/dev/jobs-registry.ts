import 'server-only';
import { complianceGenerate } from '@/jobs/compliance-generate';
import { announcementFeeds } from '@/jobs/announcement-feeds';
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { complianceReminders } from '@/jobs/compliance-reminders';
import { savedReportsSend } from '@/jobs/saved-reports-send';
import { weeklyDigest } from '@/jobs/weekly-digest';
import { kpiSnapshots } from '@/jobs/kpi-snapshots';
import { staffAlerts } from '@/jobs/staff-alerts';
import { dailyDigest } from '@/jobs/daily-digest';
import { serviceChecks } from '@/jobs/service-checks';
import { describeFunctions } from './parse';
import type { JobFunction } from './types';

/**
 * The Inngest functions in `src/jobs/`, described from their own config. Keep this list in
 * step with the `functions` array in `app/api/inngest/route.ts`.
 */
export function registeredJobs(): JobFunction[] {
  return describeFunctions([
    complianceGenerate,
    announcementFeeds,
    whatsappSend,
    askIngest,
    complianceReminders,
    savedReportsSend,
    weeklyDigest,
    kpiSnapshots,
    staffAlerts,
    dailyDigest,
    serviceChecks,
  ]);
}
