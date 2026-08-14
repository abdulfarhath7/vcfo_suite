export type ComplianceFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'annual' | 'one-time';
export type ComplianceStatus = 'upcoming' | 'in-progress' | 'filed' | 'overdue';
export type PenaltyRisk = 'low' | 'medium' | 'high';

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

export const seedCompliance: ComplianceFiling[] = [
  { id: 'cf1',  engagementId: 'e1', filing: 'GSTR-1',          authority: 'GST',  frequency: 'monthly',   nextDue: '2026-06-11', ownerId: 'tm1', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf2',  engagementId: 'e1', filing: 'GSTR-3B',         authority: 'GST',  frequency: 'monthly',   nextDue: '2026-06-20', ownerId: 'tm1', status: 'in-progress', penaltyRisk: 'medium' },
  { id: 'cf3',  engagementId: 'e1', filing: 'TDS 26Q',         authority: 'IT',   frequency: 'quarterly', nextDue: '2026-07-31', ownerId: 'tm2', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf4',  engagementId: 'e1', filing: 'PF Return',       authority: 'EPFO', frequency: 'monthly',   nextDue: '2026-06-15', ownerId: 'tm3', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf5',  engagementId: 'e1', filing: 'Professional Tax',authority: 'PT',   frequency: 'monthly',   nextDue: '2026-05-30', ownerId: 'tm3', status: 'overdue',     penaltyRisk: 'high' },
  { id: 'cf6',  engagementId: 'e2', filing: 'GSTR-3B',         authority: 'GST',  frequency: 'monthly',   nextDue: '2026-06-20', ownerId: 'tm2', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf7',  engagementId: 'e2', filing: 'Advance Tax',     authority: 'IT',   frequency: 'quarterly', nextDue: '2026-06-15', ownerId: 'tm2', status: 'in-progress', penaltyRisk: 'medium' },
  { id: 'cf8',  engagementId: 'e2', filing: 'ROC AOC-4',       authority: 'MCA',  frequency: 'annual',    nextDue: '2026-10-30', ownerId: 'tm1', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf9',  engagementId: 'e2', filing: 'ROC MGT-7',       authority: 'MCA',  frequency: 'annual',    nextDue: '2026-11-29', ownerId: 'tm1', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf10', engagementId: 'e3', filing: 'GSTR-1',          authority: 'GST',  frequency: 'monthly',   nextDue: '2026-06-11', ownerId: 'tm1', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf11', engagementId: 'e3', filing: 'TDS 24Q',         authority: 'IT',   frequency: 'quarterly', nextDue: '2026-07-31', ownerId: 'tm3', status: 'upcoming',    penaltyRisk: 'low' },
  { id: 'cf12', engagementId: 'e1', filing: 'FLA Return',      authority: 'RBI',  frequency: 'annual',    nextDue: '2026-07-15', ownerId: 'tm2', status: 'in-progress', penaltyRisk: 'medium' },
];
