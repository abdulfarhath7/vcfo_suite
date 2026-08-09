import type { CompanyType, EntityLegalForm } from '@/data/engagements';
import { ENTITY_LEGAL_FORM_LABEL } from '@/lib/compliance/types';

export type Stage = 'Pre-Incorporation' | 'Post-Incorporation' | 'Operational Readiness';

export const PHASES: Array<{ value: Stage; label: string; hint: string }> = [
  { value: 'Pre-Incorporation', label: 'Pre-Incorporation', hint: 'Name reservation, DSC, MoA/AoA' },
  { value: 'Post-Incorporation', label: 'Post-Incorporation', hint: 'PAN, TAN, bank, GST registrations' },
];

export const PHASE_MILESTONES: Record<Stage, string[]> = {
  'Pre-Incorporation': ['Name approval (RUN)', 'DSC for directors', 'MoA / AoA drafting', 'SPICe+ filing'],
  'Post-Incorporation': ['PAN & TAN allotment', 'Bank account opening', 'INC-20A commencement', 'GST registration'],
  'Operational Readiness': ['FCGPR / FEMA filings', 'Payroll & PF/ESI setup', 'Auditor appointment', 'Ongoing ROC compliance'],
};

export const PHASE_ORDER: Stage[] = ['Pre-Incorporation', 'Post-Incorporation'];

export const COMPANY_TYPES: Array<{ value: CompanyType; label: string; hint: string }> = [
  { value: 'domestic', label: 'Domestic', hint: 'India-incorporated entity' },
  { value: 'foreign', label: 'Foreign', hint: 'Overseas parent · FEMA track' },
];

export const ENTITY_LEGAL_FORMS: Array<{ value: EntityLegalForm; label: string; hint: string }> = [
  { value: 'company', label: ENTITY_LEGAL_FORM_LABEL.company, hint: 'Private / public limited company' },
  { value: 'llp', label: ENTITY_LEGAL_FORM_LABEL.llp, hint: 'Limited Liability Partnership' },
  { value: 'partnership', label: ENTITY_LEGAL_FORM_LABEL.partnership, hint: 'Registered partnership firm' },
  { value: 'proprietorship', label: ENTITY_LEGAL_FORM_LABEL.proprietorship, hint: 'Sole proprietorship' },
];

export const HEALTH_OPTIONS: Array<{
  value: 'on-track' | 'at-risk' | 'overdue';
  label: string;
  hint: string;
}> = [
  { value: 'on-track', label: 'On track', hint: 'Milestones on schedule' },
  { value: 'at-risk', label: 'Needs review', hint: 'Emerging blockers or slip' },
  { value: 'overdue', label: 'Past due', hint: 'Critical steps behind plan' },
];

export function passwordStrength(pw: string): 'weak' | 'fair' | 'strong' | null {
  if (!pw) return null;
  if (pw.length < 8) return 'weak';
  const hasNum = /\d/.test(pw);
  const hasSym = /[^A-Za-z0-9]/.test(pw);
  const hasMixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  if (pw.length >= 12 && hasNum && (hasSym || hasMixed)) return 'strong';
  if (pw.length >= 8 && (hasNum || hasSym)) return 'fair';
  return 'weak';
}

export type CreateProjectState = {
  companyName: string;
  companyType: CompanyType;
  entityLegalForm: EntityLegalForm;
  parentEntityName: string;
  parentEntityAddress: string;
  clientContact: string;
  clientEmail: string;
  clientPassword: string;
  internId: string;
  managerId: string;
  stage: Stage;
  health: 'on-track' | 'at-risk' | 'overdue';
  submitting: boolean;
  showValidation: boolean;
  showPassword: boolean;
};

export type CreateProjectAction =
  | { type: 'patch'; patch: Partial<CreateProjectState> }
  | { type: 'toggle_show_password' }
  | { type: 'reset'; internId: string; managerId?: string };

export const DEFAULT_CLIENT_TEMP_PASSWORD = 'SBC@2026';

export function createProjectReducer(state: CreateProjectState, action: CreateProjectAction): CreateProjectState {
  switch (action.type) {
    case 'toggle_show_password':
      return { ...state, showPassword: !state.showPassword };
    case 'reset':
      return {
        companyName: '',
        companyType: 'domestic',
        entityLegalForm: 'company',
        parentEntityName: '',
        parentEntityAddress: '',
        clientContact: '',
        clientEmail: '',
        clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
        internId: action.internId,
        managerId: action.managerId ?? state.managerId,
        stage: 'Pre-Incorporation',
        health: 'on-track',
        submitting: false,
        showValidation: false,
        showPassword: false,
      };
    case 'patch':
      return { ...state, ...action.patch };
    default:
      return state;
  }
}
