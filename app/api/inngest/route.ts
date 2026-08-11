import { serve } from 'inngest/next';
import { inngest } from '@/jobs/client';
import { complianceGenerate } from '@/jobs/compliance-generate';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [complianceGenerate],
});
