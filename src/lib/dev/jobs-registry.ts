import 'server-only';
import { complianceGenerate, complianceRegenerate } from '@/jobs/compliance-generate';
import { announcementFeeds } from '@/jobs/announcement-feeds';
import { watchCheck } from '@/jobs/watch-check';
import { watchProcess } from '@/jobs/watch-process';
import { watchDailySummary } from '@/jobs/watch-daily-summary';
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { askDrop } from '@/jobs/ask-drop';
import { askFill } from '@/jobs/ask-fill';
import { complianceReminders } from '@/jobs/compliance-reminders';
import { savedReportsSend } from '@/jobs/saved-reports-send';
import { weeklyDigest } from '@/jobs/weekly-digest';
import { kpiSnapshots } from '@/jobs/kpi-snapshots';
import { staffAlerts } from '@/jobs/staff-alerts';
import { dailyDigest } from '@/jobs/daily-digest';
import { serviceChecks } from '@/jobs/service-checks';
import { complianceTaskReminders } from '@/jobs/compliance-task-reminders';
import { complianceTaskRepeatOnComplete, complianceTaskRepeatSweep } from '@/jobs/compliance-task-repeat';
import { boardMeetingReminders } from '@/jobs/board-meeting-reminders';
import { askIndexRefresh, askIndexSweep } from '@/jobs/ask-index-refresh';
import { receivablesFxRates } from '@/jobs/receivables-fx-rates';
import { receivablesRollup } from '@/jobs/receivables-rollup';
import { receivablesLeadershipDigest } from '@/jobs/receivables-leadership-digest';
import { receivablesApprovalEmails } from '@/jobs/receivables-approval-emails';
import { receivablesEmailPing } from '@/jobs/receivables-email-ping';
import { devCleanup } from '@/jobs/dev-cleanup';
import { budgetAlerts } from '@/jobs/budget-alerts';
import { requestListReminders } from '@/jobs/request-list-reminders';
import { expiryAlerts } from '@/jobs/expiry-alerts';
import { myDayEmail } from '@/jobs/my-day-email';
import { assistFilingDeadlines } from '@/jobs/assist-filing-deadlines';
import { gstRegistrationStart } from '@/jobs/gst-registration-start';
import { fieldAskDelivery, fieldAskReminders } from '@/jobs/field-ask-emails';
import { zohoDiscover, zohoReceivablesSync } from '@/jobs/integrations-zoho';
import { liveBrowserReaper } from '@/jobs/live-browser-reaper';
import { gstReturnWork } from '@/jobs/gst-return-work';
import { gstnSessionRefresh } from '@/jobs/gstn-session-refresh';
import { gstNoticesDaily } from '@/jobs/gst-notices-daily';
import { describeFunctions } from './parse';
import type { JobFunction } from './types';

/**
 * The Inngest functions in `src/jobs/`, described from their own config. Keep this list in
 * step with the `functions` array in `app/api/inngest/route.ts`.
 */
export function registeredJobs(): JobFunction[] {
  return describeFunctions([
    complianceGenerate,
    complianceRegenerate,
    announcementFeeds,
    whatsappSend,
    askIngest,
    askDrop,
    askFill,
    askIndexRefresh,
    askIndexSweep,
    complianceReminders,
    savedReportsSend,
    weeklyDigest,
    kpiSnapshots,
    staffAlerts,
    dailyDigest,
    serviceChecks,
    devCleanup,
    complianceTaskReminders,
    complianceTaskRepeatOnComplete,
    complianceTaskRepeatSweep,
    boardMeetingReminders,
    receivablesFxRates,
    receivablesRollup,
    receivablesLeadershipDigest,
    receivablesApprovalEmails,
    receivablesEmailPing,
    budgetAlerts,
    watchCheck,
    watchProcess,
    watchDailySummary,
    requestListReminders,
    expiryAlerts,
    myDayEmail,
    assistFilingDeadlines,
    gstRegistrationStart,
    fieldAskDelivery,
    fieldAskReminders,
    zohoDiscover,
    zohoReceivablesSync,
    liveBrowserReaper,
    gstReturnWork,
    gstnSessionRefresh,
    gstNoticesDaily,
  ]);
}
