import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import type { EngagementComplianceTriggers } from '@/lib/compliance/types';

type ChecklistState = Record<string, ChecklistItemStateSlice>;

function pickDate(state: ChecklistState, itemId: string, fieldId: string): string | null {
  const raw = state[itemId]?.responses?.[fieldId];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed || null;
}

/** Extract compliance trigger dates from incorporation checklist milestone responses. */
export function extractTriggersFromChecklist(
  state: ChecklistState,
  existing?: EngagementComplianceTriggers,
): EngagementComplianceTriggers {
  const incorporationDate = pickDate(state, 'pre-12', 'dateOfIncorporation');
  const gstRegistrationDate = pickDate(state, 'reg-4', 'gstRegistrationDate');
  const pfRegistrationDate = pickDate(state, 'reg-1', 'pfRegistrationDate');
  const esiRegistrationDate = pickDate(state, 'reg-3', 'esiRegistrationDate');
  const tanRegistrationDate = pickDate(state, 'reg-2', 'panTanAllotmentDate');

  return {
    incorporationDate: incorporationDate ?? existing?.incorporationDate ?? null,
    gstRegistrationDate: gstRegistrationDate ?? existing?.gstRegistrationDate ?? null,
    pfRegistrationDate: pfRegistrationDate ?? existing?.pfRegistrationDate ?? null,
    esiRegistrationDate: esiRegistrationDate ?? existing?.esiRegistrationDate ?? null,
    tanRegistrationDate: tanRegistrationDate ?? existing?.tanRegistrationDate ?? null,
    tdsLiabilityStartDate:
      tanRegistrationDate ?? existing?.tdsLiabilityStartDate ?? null,
    ptRegistrationDate: existing?.ptRegistrationDate ?? null,
    agmDate: existing?.agmDate ?? null,
  };
}
