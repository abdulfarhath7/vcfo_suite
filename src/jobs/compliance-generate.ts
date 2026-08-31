import { inngest } from './client';
import {
  systemGenerateComplianceInstances,
  systemListComplianceNudges,
} from '@/db/repositories/compliance';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { queueWhatsAppSends } from '@/lib/notify/send-whatsapp';

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

    /**
     * WhatsApp nudges for the deadlines that just entered their window.
     * Runs after generation so a freshly created instance is eligible the same
     * day. Every enqueue carries a deterministic id keyed on the instance and
     * the recipient, so a re-run cannot message anyone twice.
     *
     * Due reminders go to clients. Overdue also goes to the project leads.
     */
    const nudges = await step.run('queue-whatsapp-nudges', async () => {
      const rows = await systemListComplianceNudges(new Date());
      let queued = 0;

      for (const row of rows) {
        const recipients = await resolveEngagementRecipients(row.engagementDbId);
        if (!recipients) continue;

        const clients =
          recipients.clients.length > 0
            ? recipients.clients
            : recipients.client
              ? [recipients.client]
              : [];

        const leads =
          row.kind === 'compliance_overdue'
            ? recipients.leads.length > 0
              ? recipients.leads
              : recipients.lead
                ? [recipients.lead]
                : []
            : [];

        const variables = {
          companyName: row.companyName,
          obligationName: row.obligationName,
          dueDate: row.dueDate,
        };

        const targets = [...clients, ...leads];
        await queueWhatsAppSends(
          targets.map((party) => ({
            engagementId: recipients.appId,
            recipientProfileId: party.userId,
            event: row.kind,
            variables,
            dedupeId: `wa-${row.kind}-${row.instanceId}-${party.userId}`,
          })),
        );
        queued += targets.length;
      }

      return { scanned: rows.length, queued };
    });

    return { ...result, nudges };
  },
);
