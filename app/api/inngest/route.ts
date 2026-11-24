import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate, complianceRegenerate } from '@/jobs/compliance-generate';
import { kpiSnapshots } from '@/jobs/kpi-snapshots';
import { staffAlerts } from '@/jobs/staff-alerts';
import { dailyDigest } from '@/jobs/daily-digest';
import { announcementFeeds } from '@/jobs/announcement-feeds';
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { askDrop } from '@/jobs/ask-drop';
import { askFill } from '@/jobs/ask-fill';
import { askIndexRefresh, askIndexSweep } from '@/jobs/ask-index-refresh';
import { complianceReminders } from '@/jobs/compliance-reminders';
import { savedReportsSend } from '@/jobs/saved-reports-send';
import { weeklyDigest } from '@/jobs/weekly-digest';
import { serviceChecks } from '@/jobs/service-checks';
import { complianceTaskReminders } from '@/jobs/compliance-task-reminders';
import { complianceTaskRepeatOnComplete, complianceTaskRepeatSweep } from '@/jobs/compliance-task-repeat';
import { boardMeetingReminders } from '@/jobs/board-meeting-reminders';
import { gstRegistrationStart } from '@/jobs/gst-registration-start';
import { receivablesFxRates } from '@/jobs/receivables-fx-rates';
import { receivablesRollup } from '@/jobs/receivables-rollup';
import { receivablesLeadershipDigest } from '@/jobs/receivables-leadership-digest';
import { receivablesApprovalEmails } from '@/jobs/receivables-approval-emails';
import { receivablesEmailPing } from '@/jobs/receivables-email-ping';
import { devCleanup } from '@/jobs/dev-cleanup';
import { watchCheck } from '@/jobs/watch-check';
import { watchProcess } from '@/jobs/watch-process';
import { watchDailySummary } from '@/jobs/watch-daily-summary';
import { budgetAlerts } from '@/jobs/budget-alerts';
import { requestListReminders } from '@/jobs/request-list-reminders';
import { expiryAlerts } from '@/jobs/expiry-alerts';
import { myDayEmail } from '@/jobs/my-day-email';
import { assistFilingDeadlines } from '@/jobs/assist-filing-deadlines';
import { statutoryCalendarAskSync } from '@/jobs/statutory-calendar-ask';
import { fieldAskDelivery, fieldAskReminders } from '@/jobs/field-ask-emails';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate, complianceRegenerate, announcementFeeds, whatsappSend, askIngest, askDrop, askFill, askIndexRefresh, askIndexSweep, complianceReminders, savedReportsSend, weeklyDigest, kpiSnapshots, staffAlerts, dailyDigest, serviceChecks, devCleanup, complianceTaskReminders, complianceTaskRepeatOnComplete, complianceTaskRepeatSweep, boardMeetingReminders, receivablesFxRates, receivablesRollup, receivablesLeadershipDigest, receivablesApprovalEmails, receivablesEmailPing, watchCheck, watchProcess, watchDailySummary, budgetAlerts, requestListReminders, expiryAlerts, myDayEmail, assistFilingDeadlines, statutoryCalendarAskSync, gstRegistrationStart, fieldAskDelivery, fieldAskReminders],
});
