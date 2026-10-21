import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate } from '@/jobs/compliance-generate';
import { announcementFeeds } from '@/jobs/announcement-feeds';
import { whatsappSend } from '@/jobs/whatsapp-send';
import { askIngest } from '@/jobs/ask-ingest';
import { complianceReminders } from '@/jobs/compliance-reminders';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate, announcementFeeds, whatsappSend, askIngest, complianceReminders],
});
