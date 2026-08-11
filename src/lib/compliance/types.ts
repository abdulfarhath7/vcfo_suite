export type EntityLegalForm = 'company' | 'llp' | 'partnership' | 'proprietorship';

export const ENTITY_LEGAL_FORM_LABEL: Record<EntityLegalForm, string> = {
  company: 'Company (Pvt Ltd)',
  llp: 'LLP',
  partnership: 'Partnership Firm',
  proprietorship: 'Proprietorship',
};

export type ComplianceTriggerType =
  | 'fy_end'
  | 'gst_registration'
  | 'tds_liability'
  | 'pf_registration'
  | 'esi_registration'
  | 'pt_registration'
  | 'incorporation'
  | 'fixed_annual'
  | 'event'
  | 'manual';

export type DueRule =
  | { kind: 'fixed-calendar-date'; month: number; day: number }
  | { kind: 'quarterly-calendar'; quarters: Array<{ month: number; day: number; label: string }> }
  | { kind: 'nth-day-next-month'; day: number }
  | { kind: 'days-after-fy-end'; days: number }
  | { kind: 'days-after-agm'; days: number }
  | { kind: 'days-after-event'; days: number }
  | { kind: 'monthly-from-anchor' };

export type ComplianceFrequency =
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'annual'
  | 'one-time';

export type ComplianceStatus = 'upcoming' | 'in-progress' | 'filed' | 'overdue';

export type PenaltyRisk = 'low' | 'medium' | 'high';

export interface EntityApplicability {
  company: boolean;
  llp: boolean;
  partnership: boolean;
  proprietorship: boolean;
}

export interface ComplianceObligation {
  id: string;
  complianceArea: string;
  particular: string;
  authority: string;
  frequency: ComplianceFrequency;
  triggerType: ComplianceTriggerType;
  dueRule: DueRule;
  appliesTo: EntityApplicability;
  applicabilityNote?: string;
  isConditional?: boolean;
  penaltyRisk: PenaltyRisk;
}

export interface EngagementComplianceTriggers {
  incorporationDate?: string | null;
  gstRegistrationDate?: string | null;
  tanRegistrationDate?: string | null;
  pfRegistrationDate?: string | null;
  esiRegistrationDate?: string | null;
  ptRegistrationDate?: string | null;
  tdsLiabilityStartDate?: string | null;
  agmDate?: string | null;
}

export interface ComplianceInstance {
  id: string;
  engagementId: string;
  obligationId: string;
  filing: string;
  authority: string;
  frequency: ComplianceFrequency;
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  periodLabel?: string;
  fyLabel?: string;
  ownerId: string;
  status: ComplianceStatus;
  penaltyRisk: PenaltyRisk;
}

export interface FyPeriod {
  label: string;
  short: boolean;
  start: Date;
  end: Date;
}
