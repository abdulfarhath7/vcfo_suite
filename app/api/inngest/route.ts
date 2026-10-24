import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate } from '@/jobs/compliance-generate';
// `announcementFeeds` (direct RSS → board, no review) is no longer scheduled: every official
// update goes through the manager review gate (`askFeeds`) since 2026-10-24.
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { askFeeds } from '@/jobs/ask-feeds';
import { complianceReminders } from '@/jobs/compliance-reminders';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate, whatsappSend, askIngest, askFeeds, complianceReminders],
});
