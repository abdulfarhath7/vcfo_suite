import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate } from '@/jobs/compliance-generate';
import { kpiSnapshots } from '@/jobs/kpi-snapshots';
import { staffAlerts } from '@/jobs/staff-alerts';
import { dailyDigest } from '@/jobs/daily-digest';
import { announcementFeeds } from '@/jobs/announcement-feeds';
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { complianceReminders } from '@/jobs/compliance-reminders';
import { savedReportsSend } from '@/jobs/saved-reports-send';
import { weeklyDigest } from '@/jobs/weekly-digest';
import { serviceChecks } from '@/jobs/service-checks';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate, announcementFeeds, whatsappSend, askIngest, complianceReminders, savedReportsSend, weeklyDigest, kpiSnapshots, staffAlerts, dailyDigest, serviceChecks],
});
