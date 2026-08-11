import { inngest } from './client';
import { systemGenerateComplianceInstances } from '@/db/repositories/compliance';

/**
 * Scheduled: expand compliance obligations into dated instances.
 * Replaces the old client-side compliance-store.ts localStorage cache.
 *
 * Persistence and access control live in
 * `src/db/repositories/compliance.ts` (`systemGenerateComplianceInstances`).
 * Pure date math lives in `src/lib/compliance/generate-instances.ts`.
 */
export const complianceGenerate = inngest.createFunction(
  { id: 'compliance-generate' },
  { cron: '0 6 * * *' }, // daily 06:00
  async ({ step }) => {
    const result = await step.run('generate-instances', async () => {
      return systemGenerateComplianceInstances(new Date());
    });

    await step.run('log-digest', async () => {
      // Email digest lands later; console is enough for local/Inngest verification.
      console.log('[compliance-generate] digest', {
        engagements: result.engagements,
        generated: result.generated,
        upserted: result.upserted,
        byEngagement: result.digest,
      });
      return { logged: true };
    });

    return result;
  },
);
