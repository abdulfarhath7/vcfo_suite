import { ownershipDisplayLabel, type Engagement } from '@/data/engagements';
import { ENTITY_LEGAL_FORM_LABEL } from '@/lib/compliance/types';

export function companyPickerHint(
  engagement: Pick<
    Engagement,
    'companyType' | 'ownershipType' | 'parentIndianRelationship' | 'entityLegalForm'
  >,
): string {
  const form = engagement.entityLegalForm
    ? ENTITY_LEGAL_FORM_LABEL[engagement.entityLegalForm]
    : null;
  // Ownership, not companyType alone: a Standalone row is stored `domestic` too.
  const ownership = ownershipDisplayLabel(engagement);
  return form ? `${form} · ${ownership}` : ownership;
}
