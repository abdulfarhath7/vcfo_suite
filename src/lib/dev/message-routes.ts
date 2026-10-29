import { NOTIFY_EVENTS } from '@/lib/notify/types';
import { readTemplateNames } from '@/lib/notify/templates';

/**
 * The outbound message routes the code defines: every notify event goes out by email and,
 * as a nudge, by WhatsApp with its approved template name (`readTemplateNames`).
 */
export function messageRoutes(env: NodeJS.ProcessEnv = process.env): Array<{ event: string; channel: 'email' | 'whatsapp'; template: string | null }> {
  const names = readTemplateNames(env);
  return NOTIFY_EVENTS.flatMap((event) => [
    { event, channel: 'email' as const, template: null },
    { event, channel: 'whatsapp' as const, template: names[event] },
  ]);
}
