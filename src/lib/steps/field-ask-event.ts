import 'server-only';
import { inngest } from '@/jobs/client';
import { FIELDS_ASKED_EVENT, type FieldAskEventData } from '@/lib/steps/field-ask-email';

/**
 * Asks the field ask job (`src/jobs/field-ask-emails.ts`) to email the client about one step.
 * Never throws: the field state is already saved, and the daily reminder run catches up if the
 * send fails.
 */
export async function requestFieldAskDelivery(data: FieldAskEventData): Promise<void> {
  try {
    await inngest.send({ name: FIELDS_ASKED_EVENT, data: data as unknown as Record<string, unknown> });
  } catch (err) {
    console.error('[field-ask] send failed', data.engagementDbId, data.itemId, err);
  }
}
