import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate } from '@/jobs/compliance-generate';
// `announcementFeeds` (direct RSS → board, no review) is no longer scheduled: every official
// update goes through the manager review gate (`askFeeds`) since 2026-10-24.
import { kpiSnapshots } from '@/jobs/kpi-snapshots';
import { staffAlerts } from '@/jobs/staff-alerts';
import { dailyDigest } from '@/jobs/daily-digest';
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { askFeeds } from '@/jobs/ask-feeds';
import { complianceReminders } from '@/jobs/compliance-reminders';
import { savedReportsSend } from '@/jobs/saved-reports-send';
import { weeklyDigest } from '@/jobs/weekly-digest';
import { serviceChecks } from '@/jobs/service-checks';
import { complianceTaskReminders } from '@/jobs/compliance-task-reminders';
import { complianceTaskRepeatOnComplete, complianceTaskRepeatSweep } from '@/jobs/compliance-task-repeat';
import { devCleanup } from '@/jobs/dev-cleanup';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate, whatsappSend, askIngest, askFeeds, complianceReminders, savedReportsSend, weeklyDigest, kpiSnapshots, staffAlerts, dailyDigest, serviceChecks, devCleanup, complianceTaskReminders, complianceTaskRepeatOnComplete, complianceTaskRepeatSweep],
});
