import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate } from '@/jobs/compliance-generate';
import { announcementFeeds } from '@/jobs/announcement-feeds';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate, announcementFeeds],
});
