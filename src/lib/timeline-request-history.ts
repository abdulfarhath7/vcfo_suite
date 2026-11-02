/**
 * Timeline change requests across a book (manager console › Date requests ›
 * Decided). Client-safe: the type the page reads and the pure mapper the
 * repository (`src/db/repositories/timeline-requests.ts`) uses.
 */
import type { TimelinePhaseDates } from '@/lib/client-home';
import { appEngagementId } from '@/lib/legacy-engagement-ids';

export type TimelineRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface BookTimelineRequest {
  id: string;
  /** App engagement id (legacy `e1` for seeded rows, else the uuid). */
  engagementId: string;
  status: TimelineRequestStatus;
  reason: string;
  phases: TimelinePhaseDates[];
  coiFrom?: string;
  coiTo?: string;
  slipDays: number;
  createdAt: string;
  updatedAt: string;
  requestedByName?: string;
  decidedAt?: string;
  decidedBy?: string;
  decidedByName?: string;
  decisionNote?: string;
}

/** The stored row, structurally (`client_timeline_requests`). */
export interface TimelineRequestRowLike {
  id: string;
  engagementId: string;
  status: string;
  reason: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
  requestedByName: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
}

const STATUSES: readonly TimelineRequestStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];
const PHASE_IDS = new Set(['p1', 'p2', 'mca', 'coi']);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function toBookTimelineRequest(row: TimelineRequestRowLike, names: ReadonlyMap<string, string>): BookTimelineRequest {
  const p = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as {
    phases?: unknown;
    coiFrom?: unknown;
    coiTo?: unknown;
    slipDays?: unknown;
  };
  const phases = (Array.isArray(p.phases) ? p.phases : [])
    .filter(
      (x): x is TimelinePhaseDates =>
        !!x && typeof x === 'object' && PHASE_IDS.has((x as TimelinePhaseDates).id) && ISO.test(String((x as TimelinePhaseDates).from)) && ISO.test(String((x as TimelinePhaseDates).to)),
    )
    .map((x) => ({ id: x.id, name: String(x.name ?? ''), from: x.from, to: x.to }));
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    status: (STATUSES as readonly string[]).includes(row.status) ? (row.status as TimelineRequestStatus) : 'pending',
    reason: row.reason,
    phases,
    coiFrom: str(p.coiFrom),
    coiTo: str(p.coiTo),
    slipDays: typeof p.slipDays === 'number' && Number.isFinite(p.slipDays) ? p.slipDays : 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requestedByName: row.requestedByName ?? undefined,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : undefined,
    decidedBy: row.decidedBy ?? undefined,
    decidedByName: row.decidedBy ? names.get(row.decidedBy) : undefined,
    decisionNote: row.decisionNote?.trim() || undefined,
  };
}
