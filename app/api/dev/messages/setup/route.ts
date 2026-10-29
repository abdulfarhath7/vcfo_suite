import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { checkMailDomain } from '@/lib/dev/domain';
import { readWhatsAppTemplates } from '@/lib/dev/aws';
import { messageRoutes } from '@/lib/dev/message-routes';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import type { MessagesSetupPayload } from '@/lib/dev/types';
import { emailTemplatesForDev, failureCausesForDev, messageRoutesForDev, messageTimingForDev } from '@/db/repositories/dev-messages';

/**
 * GET /api/dev/messages/setup: the cards under the message log. Message routes with 7-day
 * numbers, failed messages in 24 hours by cause, the step mail templates and the WhatsApp
 * templates (from AWS End User Messaging when set up), the mail domain check, and the
 * timing the code and firm settings give (reminder days, job schedules). Read only.
 * Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<MessagesSetupPayload> => {
    const [routes, causes, emailTemplates, whatsappTemplates, domain, timing] = await Promise.all([
      messageRoutesForDev(ctx, messageRoutes()),
      failureCausesForDev(ctx),
      emailTemplatesForDev(ctx),
      readWhatsAppTemplates(),
      checkMailDomain(),
      messageTimingForDev(ctx),
    ]);
    const schedules = registeredJobs()
      .filter((f) => f.trigger.kind === 'cron')
      .map((f) => ({ id: f.id, cron: f.trigger.kind === 'cron' ? f.trigger.cron : '' }));
    return { routes, causes, emailTemplates, whatsappTemplates, domain, timing: { ...timing, schedules } };
  });
}
