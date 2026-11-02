import type { FeatureFlag } from './types';

/**
 * Feature switches the app reads from env vars, for the Deploys page. They change with the
 * service's env (Terraform), so the console shows them and does not flip them.
 */
const FLAGS: Array<{ id: string; name: string; who: string; on: (env: Record<string, string | undefined>) => boolean }> = [
  { id: 'WHATSAPP_ENABLED', name: 'WhatsApp nudges', who: 'Clients and staff with a number', on: (e) => (e.WHATSAPP_ENABLED ?? '').trim().toLowerCase() === 'true' },
  { id: 'ASK_VCFO_ENABLED', name: 'Ask VCFO', who: 'Everyone signed in', on: (e) => (e.ASK_VCFO_ENABLED ?? '').trim().toLowerCase() === 'true' },
  { id: 'EMAIL_PROVIDER', name: 'Mail through Amazon SES', who: 'Every outbound mail', on: (e) => (e.EMAIL_PROVIDER ?? '').trim().toLowerCase() === 'ses' },
  { id: 'AWS_COST_EXPLORER', name: 'Costs in the console', who: 'Developer console', on: (e) => (e.AWS_COST_EXPLORER ?? '').trim().toLowerCase() === 'on' },
];

export function featureFlags(env: Record<string, string | undefined> = process.env): FeatureFlag[] {
  return FLAGS.map((f) => ({ id: f.id, name: f.name, who: f.who, on: f.on(env) }));
}
