'use client';

import type { ChecklistItem } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { MilestoneResponseFormView } from './MilestoneResponseFormSections';
import { useMilestoneResponseFormState } from './useMilestoneResponseFormState';

export { PendingFieldsHint, Pre1SectionCard, FormErrorSummary } from '@/views/incorporation/MilestoneResponseFormParts';
import '@/views/incorporation/milestone-response-form-utils';

interface MilestoneResponseFormProps {
  item: ChecklistItem;
  clientId: string;
  engagementId?: string;
  responses?: ChecklistItemResponses;
  variant?: 'admin' | 'client';
  readOnly?: boolean;
  showFieldUnlock?: boolean;
  open?: boolean;
  className?: string;
  /** Flatten nested card chrome when the host page already provides a workspace. */
  compactChrome?: boolean;
}

function MilestoneResponseFormKeyed(props: MilestoneResponseFormProps) {
  const vm = useMilestoneResponseFormState(props);
  if (!vm) return null;
  return <MilestoneResponseFormView {...vm} />;
}

export function MilestoneResponseForm(props: MilestoneResponseFormProps) {
  const scopeKey = `${props.item.id}:${props.clientId}:${props.engagementId ?? ''}`;
  return <MilestoneResponseFormKeyed key={scopeKey} {...props} />;
}
