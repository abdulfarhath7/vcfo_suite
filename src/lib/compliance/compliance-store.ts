/**
 * Client-side compliance helpers.
 *
 * Persistence moved to Postgres via the Inngest job
 * (`src/jobs/compliance-generate.ts` → `systemGenerateComplianceInstances`).
 * This module only expands instances in-memory for UI hooks using the same
 * pure generator — no localStorage.
 */
import type { ComplianceFiling } from '@/data/compliance';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { extractTriggersFromChecklist } from '@/lib/compliance/extract-triggers';
import { generateComplianceInstances } from '@/lib/compliance/generate-instances';
import type { EntityLegalForm } from '@/lib/compliance/types';

export function computeAllFilings(
  engagements: Engagement[],
  checklistStates: Record<string, Record<string, ChecklistItemStateSlice>>,
): ComplianceFiling[] {
  const out: ComplianceFiling[] = [];

  for (const engagement of engagements) {
    const state = checklistStates[engagement.id] ?? {};
    const triggers = extractTriggersFromChecklist(state, {
      incorporationDate: engagement.incorporationDate ?? null,
    });

    const instances = generateComplianceInstances({
      engagementId: engagement.id,
      entityLegalForm: (engagement.entityLegalForm ?? 'company') as EntityLegalForm,
      triggers,
      ownerId: engagement.internId,
    });

    for (const instance of instances) {
      out.push({
        id: instance.id,
        engagementId: instance.engagementId,
        filing: instance.filing,
        authority: instance.authority,
        frequency: instance.frequency,
        nextDue: instance.dueDate,
        ownerId: instance.ownerId,
        status: instance.status,
        penaltyRisk: instance.penaltyRisk,
        periodLabel: instance.periodLabel,
        fyLabel: instance.fyLabel,
      });
    }
  }

  return out.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/**
 * Client no-op: server-side regeneration happens via the nightly Inngest job
 * (and optionally a future authenticated API that calls
 * `regenerateComplianceForEngagement` in the compliance repository).
 */
export function regenerateComplianceForEngagement(
  _engagement: Engagement,
  _checklistState: Record<string, ChecklistItemStateSlice>,
): void {
  // intentionally empty — do not write localStorage
}
