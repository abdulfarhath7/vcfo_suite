/** Sheet workflow for every statutory registration: Client → VCFO → Department. */
export type RegistrationWorkflowStage = 'collection' | 'filing' | 'approval';

export const REGISTRATION_WORKFLOW_STAGES: readonly RegistrationWorkflowStage[] = [
  'collection',
  'filing',
  'approval',
] as const;

export const REGISTRATION_WORKFLOW_LABEL: Record<RegistrationWorkflowStage, string> = {
  collection: 'Collection',
  filing: 'Filing',
  approval: 'Approval',
};

export const REGISTRATION_WORKFLOW_OWNER: Record<RegistrationWorkflowStage, string> = {
  collection: 'Client',
  filing: 'VCFO',
  approval: 'Department',
};

export function coerceRegistrationWorkflowStage(
  value: string | undefined | null,
): RegistrationWorkflowStage | undefined {
  if (value === 'collection' || value === 'filing' || value === 'approval') return value;
  return undefined;
}

export function registrationWorkflowShortLabel(stage: RegistrationWorkflowStage): string {
  return `${REGISTRATION_WORKFLOW_LABEL[stage]} · ${REGISTRATION_WORKFLOW_OWNER[stage]}`;
}
