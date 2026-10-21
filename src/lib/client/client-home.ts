/**
 * CLIENT HOME — shared shapes for `GET /api/client/home` (pure; no db, no React).
 *
 * The Home page (client portal v7) combines three reads:
 *   - `/api/client/overview`  (ClientOverview: progress, identifiers, team …)
 *   - `useApp()` checklist state → the shared step model (usePortalIncorporation)
 *   - `/api/client/home`      (this file): the items the step model cannot
 *     give — open document requests (needs), firm work items, recent documents
 *     with who uploaded them, activity with the actor, the FY's filings with
 *     their owner, masked company IDs and the timeline change-request state.
 */

export type NeedKind = 'upload' | 'fill' | 'correct' | 'sign';

export interface HomeNeedRequest {
  /** document_requests.id */
  id: string;
  title: string;
  detail?: string;
  kind: NeedKind;
  stepId?: string;
  complianceInstanceId?: string;
  dueDate?: string;
  requestedByName?: string;
  createdAt: string;
}

export interface HomeWorkItem {
  id: string;
  title: string;
  stepId?: string;
  assigneeName?: string;
  progressPct: number;
  readyOn?: string;
}

export interface HomeDoc {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  stepId: string | null;
  createdAt: string;
  /** 'client' when a client user uploaded it, 'firm' otherwise. */
  from: 'client' | 'firm';
  uploaderName?: string;
}

export interface HomeActivity {
  id: string;
  at: string;
  label: string;
  actorName: string;
  actorKind: 'firm' | 'client' | 'system';
  action: string;
}

export interface HomeFiling {
  id: string;
  title: string;
  authority: string;
  periodLabel?: string;
  fyLabel?: string;
  dueDate: string;
  filedOn?: string;
  /** upcoming | in-progress | filed | overdue (raw instance status) */
  status: string;
  /** Who owns the next move on this filing. */
  owner: 'client' | 'firm' | null;
  /** SBC's working window end ("SBC by 13 Nov"). */
  windowTo?: string;
  hasProof: boolean;
  /** Title of the open client need linked to this filing, if any. */
  needTitle?: string;
  needAskedBy?: string;
}

interface HomeIdentifiers {
  cin?: string;
  /** "AAKC••••1M" — never the clear value. */
  panMasked?: string;
  tanMasked?: string;
  gstin?: string;
}

export interface TimelinePhaseDates {
  id: 'p1' | 'p2' | 'mca' | 'coi';
  name: string;
  from: string;
  to: string;
}

export interface TimelineRequestDto {
  id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  phases: TimelinePhaseDates[];
  coiFrom?: string;
  coiTo?: string;
  slipDays: number;
  createdAt: string;
  requestedByName?: string;
}

export interface ClientHome {
  engagementId: string;
  needs: HomeNeedRequest[];
  /** Document requests on this engagement: fulfilled of total ("Documents in 4/6"). */
  requestCounts: { total: number; fulfilled: number };
  work: HomeWorkItem[];
  docs: HomeDoc[];
  activity: HomeActivity[];
  filings: { fyLabel: string; fyStartYear: number; rows: HomeFiling[] };
  identifiers: HomeIdentifiers;
  timeline: {
    lastChangedBy?: string;
    lastChangedAt?: string;
    pending?: TimelineRequestDto;
  };
}

/** Mask rule (v7c_ids): first 4 + "••••" + last 2. */
export function maskId(value?: string | null): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (v.length <= 6) return `${v.slice(0, 1)}••••`;
  return `${v.slice(0, 4)}••••${v.slice(-2)}`;
}

/** Indian FY start year for a date (Apr–Mar). */
export function fyStartYearOf(d: Date = new Date()): number {
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export function fyLabelOf(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function isNeedKind(v: unknown): v is NeedKind {
  return v === 'upload' || v === 'fill' || v === 'correct' || v === 'sign';
}
