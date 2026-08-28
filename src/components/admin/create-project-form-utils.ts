import type { CompanyType, EntityLegalForm } from '@/data/engagements';
import type { QuestionnaireAnswers } from '@/data/compliance-questionnaire';
import { ENTITY_LEGAL_FORM_LABEL } from '@/lib/compliance/types';

/** DB / API stage values — display labels differ (see STAGE_LABEL). */
export type Stage = 'Pre-Incorporation' | 'Post-Incorporation' | 'Operational Readiness';

export const STAGE_LABEL: Record<Stage, string> = {
  'Pre-Incorporation': 'Incorporation',
  'Post-Incorporation': 'Registration',
  'Operational Readiness': 'Compliance',
};

export const PHASES: Array<{ value: Stage; label: string; hint: string }> = [
  {
    value: 'Pre-Incorporation',
    label: STAGE_LABEL['Pre-Incorporation'],
    hint: 'Name reservation, DSC, MoA / AoA, SPICe+',
  },
  {
    value: 'Post-Incorporation',
    label: STAGE_LABEL['Post-Incorporation'],
    hint: 'PAN, TAN, bank, GST, INC-20A',
  },
  {
    value: 'Operational Readiness',
    label: STAGE_LABEL['Operational Readiness'],
    hint: 'FEMA / FCGPR, PF/ESI, ongoing ROC',
  },
];

/** Short display name for any stage string — falls back to the raw value. */
export function stageDisplayLabel(stage: string | null | undefined): string {
  if (!stage) return '';
  return STAGE_LABEL[stage as Stage] ?? stage;
}

export const PHASE_ORDER: Stage[] = [
  'Pre-Incorporation',
  'Post-Incorporation',
  'Operational Readiness',
];

export function stagePhaseState(
  stage: Stage,
  phase: Stage,
): 'done' | 'current' | 'upcoming' {
  const startIdx = PHASE_ORDER.indexOf(stage);
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < startIdx) return 'done';
  if (idx === startIdx) return 'current';
  return 'upcoming';
}

/** Registration / Compliance start needs India subsidiary legal details. */
export function stageRequiresSubsidiary(stage: Stage): boolean {
  return stage === 'Post-Incorporation' || stage === 'Operational Readiness';
}

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
  subsidiaryLegalName: string;
  subsidiaryRegisteredAddress: string;
  clientContact: string;
  clientEmail: string;
  clientPassword: string;
  /** Project leads; first is primary. */
  internIds: string[];
  /** Project managers; first is primary. */
  managerIds: string[];
  stage: Stage;
  health: 'on-track' | 'at-risk' | 'overdue';
  questionnaire: QuestionnaireAnswers;
  submitting: boolean;
  showValidation: boolean;
  showPassword: boolean;
};

export type CreateProjectAction =
  | { type: 'patch'; patch: Partial<CreateProjectState> }
  | { type: 'toggle_show_password' }
  | { type: 'reset'; internIds: string[]; managerIds?: string[] };

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
        subsidiaryLegalName: '',
        subsidiaryRegisteredAddress: '',
        clientContact: '',
        clientEmail: '',
        clientPassword: DEFAULT_CLIENT_TEMP_PASSWORD,
        internIds: action.internIds,
        managerIds: action.managerIds ?? state.managerIds,
        stage: 'Pre-Incorporation',
        health: 'on-track',
        questionnaire: {},
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

const DRAFT_STORAGE_KEY = 'vcfo.create-project.draft.v3';

export type CreateProjectDraftPayload = Omit<
  CreateProjectState,
  'submitting' | 'showValidation' | 'showPassword'
>;

function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function saveCreateProjectDraft(state: CreateProjectState): void {
  if (typeof window === 'undefined') return;
  const payload: CreateProjectDraftPayload = {
    companyName: state.companyName,
    companyType: state.companyType,
    entityLegalForm: state.entityLegalForm,
    parentEntityName: state.parentEntityName,
    parentEntityAddress: state.parentEntityAddress,
    subsidiaryLegalName: state.subsidiaryLegalName,
    subsidiaryRegisteredAddress: state.subsidiaryRegisteredAddress,
    clientContact: state.clientContact,
    clientEmail: state.clientEmail,
    clientPassword: state.clientPassword,
    internIds: state.internIds,
    managerIds: state.managerIds,
    stage: state.stage,
    health: state.health,
    questionnaire: state.questionnaire,
  };
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

export function loadCreateProjectDraft(): CreateProjectDraftPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.localStorage.getItem(DRAFT_STORAGE_KEY) ??
      window.localStorage.getItem('vcfo.create-project.draft.v2') ??
      window.localStorage.getItem('vcfo.create-project.draft.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateProjectDraftPayload> & {
      internId?: string;
      managerId?: string;
    };
    if (!parsed || typeof parsed !== 'object') return null;
    const internIds = asIdList(parsed.internIds ?? parsed.internId);
    const managerIds = asIdList(parsed.managerIds ?? parsed.managerId);
    return {
      companyName: typeof parsed.companyName === 'string' ? parsed.companyName : '',
      companyType: parsed.companyType === 'foreign' ? 'foreign' : 'domestic',
      entityLegalForm:
        parsed.entityLegalForm === 'llp' ||
        parsed.entityLegalForm === 'partnership' ||
        parsed.entityLegalForm === 'proprietorship'
          ? parsed.entityLegalForm
          : 'company',
      parentEntityName: typeof parsed.parentEntityName === 'string' ? parsed.parentEntityName : '',
      parentEntityAddress:
        typeof parsed.parentEntityAddress === 'string' ? parsed.parentEntityAddress : '',
      subsidiaryLegalName:
        typeof parsed.subsidiaryLegalName === 'string' ? parsed.subsidiaryLegalName : '',
      subsidiaryRegisteredAddress:
        typeof parsed.subsidiaryRegisteredAddress === 'string'
          ? parsed.subsidiaryRegisteredAddress
          : '',
      clientContact: typeof parsed.clientContact === 'string' ? parsed.clientContact : '',
      clientEmail: typeof parsed.clientEmail === 'string' ? parsed.clientEmail : '',
      clientPassword:
        typeof parsed.clientPassword === 'string' && parsed.clientPassword
          ? parsed.clientPassword
          : DEFAULT_CLIENT_TEMP_PASSWORD,
      internIds,
      managerIds,
      questionnaire:
        parsed.questionnaire && typeof parsed.questionnaire === 'object' && !Array.isArray(parsed.questionnaire)
          ? (parsed.questionnaire as QuestionnaireAnswers)
          : {},
      stage:
        parsed.stage === 'Post-Incorporation' || parsed.stage === 'Operational Readiness'
          ? parsed.stage
          : 'Pre-Incorporation',
      health:
        parsed.health === 'at-risk' || parsed.health === 'overdue' ? parsed.health : 'on-track',
    };
  } catch {
    return null;
  }
}

export function clearCreateProjectDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  window.localStorage.removeItem('vcfo.create-project.draft.v2');
  window.localStorage.removeItem('vcfo.create-project.draft.v1');
}

export function uniqueNonEmptyIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/** Legacy mock roster ids from `src/data` — never send these to POST /api/engagements. */
export function isPlaceholderTeamId(id: string): boolean {
  return /^tm\d+$/i.test(id.trim());
}

export function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Drop unknown / mock ids so Radix Select is never given a value with no item.
 * If nothing valid remains, default to the first available option.
 */
export function reconcileSelectedIds(current: string[], available: string[]): string[] {
  if (available.length === 0) {
    return uniqueNonEmptyIds(current).filter((id) => !isPlaceholderTeamId(id));
  }
  const known = uniqueNonEmptyIds(current).filter((id) => available.includes(id));
  const hasEmptySlot = current.some((id) => !id.trim());
  if (known.length === 0) return [available[0]];
  return hasEmptySlot ? [...known, ''] : known;
}

