import { COMPANY_TYPE_LABEL, type Engagement } from '@/data/engagements';
import { ENTITY_LEGAL_FORM_LABEL } from '@/lib/compliance/types';

export function companyPickerHint(
  engagement: Pick<Engagement, 'companyType' | 'entityLegalForm'>,
): string {
  const form = engagement.entityLegalForm
    ? ENTITY_LEGAL_FORM_LABEL[engagement.entityLegalForm]
    : null;
  const type = COMPANY_TYPE_LABEL[engagement.companyType];
  return form ? `${form} · ${type}` : type;
}
