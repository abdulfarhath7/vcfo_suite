import type { ChecklistField, ChecklistItem, ChecklistResponsibleRole } from '@/data/checklist';
import { getClientResponseFields, INTERN_DELIVERY_STEP_IDS } from '@/lib/checklist-responses';
import { isDeliveredToClient, type ChecklistItemStateSlice } from '@/lib/checklist-state-key';

export const RESPONSIBLE_ROLE_LABEL: Record<ChecklistResponsibleRole, string> = {
  client: 'Client',
  intern: 'Project Lead',
};

const PHASE1_STEP_IDS = new Set(['pre-1', 'pre-2', 'pre-3', 'pre-4', 'pre-5']);

/** Fields visible/editable for the current portal variant. */
export function filterFieldsByViewer(
  fields: ChecklistField[],
  variant: 'admin' | 'client',
): ChecklistField[] {
  if (variant === 'admin') return fields;
  return fields.filter((field) => field.filledBy !== 'intern');
}

function getVisibleResponseFields(
  item: ChecklistItem,
  variant: 'admin' | 'client',
): ChecklistField[] {
  return filterFieldsByViewer(getClientResponseFields(item), variant);
}

export function hasResponseFormFields(
  item: ChecklistItem,
  variant: 'admin' | 'client',
): boolean {
  return getVisibleResponseFields(item, variant).length > 0;
}

/** Statutory form labels in lists — hide when MilestoneResponseForm owns the step. */
export function shouldShowStatutoryFormLabels(
  item: ChecklistItem,
  variant: 'admin' | 'client',
): boolean {
  return item.forms.length > 0 && !hasResponseFormFields(item, variant);
}

export function isInternDeliveryStep(itemId: string): boolean {
  return INTERN_DELIVERY_STEP_IDS.has(itemId);
}

/**
 * MilestoneResponseForm read-only: explicit readOnly prop, or client viewing a delivered intern step.
 * Intern/manager keep edit access after deliver so they can correct and re-publish to the portal.
 */
export function isMilestoneFormReadOnly(params: {
  readOnly?: boolean;
  variant: 'admin' | 'client';
  itemId: string;
  itemState?: ChecklistItemStateSlice | null;
}): boolean {
  const { readOnly, variant, itemId, itemState } = params;
  if (readOnly) return true;
  return (
    variant === 'client' &&
    isInternDeliveryStep(itemId) &&
    isDeliveredToClient(itemState ?? undefined)
  );
}
