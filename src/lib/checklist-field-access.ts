import type { ChecklistField, ChecklistItem, ChecklistResponsibleRole } from '@/data/checklist';
import { getClientResponseFields, INTERN_DELIVERY_STEP_IDS } from '@/lib/checklist-responses';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

export const RESPONSIBLE_ROLE_LABEL: Record<ChecklistResponsibleRole, string> = {
  client: 'Client',
  intern: 'Project Lead',
};


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
/**
 * The client never edits a checklist step.
 *
 * A client reads their file; the firm is the only party that writes to it. When
 * something on a step is wrong, the client asks the firm to change it (see the
 * change-request action on the step) rather than editing the record directly —
 * so every value on an engagement has exactly one author.
 *
 * `readOnly` still forces read-only for staff (a locked or done step).
 */
export function isMilestoneFormReadOnly(params: {
  readOnly?: boolean;
  variant: 'admin' | 'client';
  itemId: string;
  itemState?: ChecklistItemStateSlice | null;
}): boolean {
  const { readOnly, variant } = params;
  return Boolean(readOnly) || variant === 'client';
}
