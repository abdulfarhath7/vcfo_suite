import 'server-only';
import { inngest } from '@/jobs/client';

/** Inngest event that regenerates one engagement's compliance periods (`complianceRegenerate`). */
export const COMPLIANCE_REGENERATE_EVENT = 'compliance/engagement.changed';

/**
 * Asks the job to regenerate one engagement's compliance calendar. Never throws: the change
 * that prompted it is already saved, and the 06:00 run catches up if the send fails.
 */
export async function requestComplianceRegenerate(engagementDbId: string): Promise<void> {
  try {
    await inngest.send({ name: COMPLIANCE_REGENERATE_EVENT, data: { engagementDbId } });
  } catch (err) {
    console.error('[compliance-regenerate] send failed', engagementDbId, err);
  }
}
