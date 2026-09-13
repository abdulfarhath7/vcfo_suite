type ComplianceFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'annual' | 'one-time';
type ComplianceStatus = 'upcoming' | 'in-progress' | 'filed' | 'overdue';
type PenaltyRisk = 'low' | 'medium' | 'high';

export interface ComplianceFiling {
  id: string;
  engagementId: string;
  filing: string;            // e.g. "GSTR-3B"
  authority: string;         // e.g. "GST"
  frequency: ComplianceFrequency;
  nextDue: string;           // ISO date
  ownerId: string;           // intern id
  status: ComplianceStatus;
  penaltyRisk: PenaltyRisk;
  periodLabel?: string;
  fyLabel?: string;
}
