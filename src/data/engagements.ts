import { checklist, StatusCode } from './checklist';
import type { EntityLegalForm } from '@/lib/compliance/types';

export type CompanyType = 'domestic' | 'foreign';
export type { EntityLegalForm };

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  domestic: 'Domestic',
  foreign: 'Foreign',
};

export interface Engagement {
  id: string;
  /** URL slug from company name (Supabase engagements.slug) */
  slug?: string;
  clientId: string;
  companyName: string;
  /** domestic = India-incorporated; foreign = overseas parent / FEMA track */
  companyType: CompanyType;
  /** Indian legal form for compliance calendar filtering */
  entityLegalForm?: EntityLegalForm;
  /** Synced from checklist pre-12 */
  incorporationDate?: string | null;
  /** Full legal name of the parent entity (overseas or group parent). */
  parentEntityName?: string | null;
  /** Full registered address of the parent entity. */
  parentEntityAddress?: string | null;
  /** Registration or incorporation number of the parent entity. */
  parentEntityRegistrationNumber?: string | null;
  internId: string;
  /** All delivery leads on this project (includes primary). */
  leadIds?: string[];
  /** Firm admin who created/owns the engagement (optional on legacy rows). */
  adminId: string;
  /** Project manager assigned to the engagement. */
  managerId?: string;
  createdAt: string;
  stage: 'Pre-Incorporation' | 'Post-Incorporation' | 'Operational Readiness';
  health: 'on-track' | 'at-risk' | 'overdue';
  /** Supabase auth user for portal client; absent on legacy/local-only rows */
  clientUserId?: string | null;
  clientEmail?: string | null;
  clientDisplayName?: string | null;
}

export interface TaskInstance {
  id: string;
  engagementId: string;
  checklistKey: string;
  status: StatusCode;
  assigneeId?: string;
  dueAt?: string;
  notes?: string;
}

export interface DocRequest {
  id: string;
  engagementId: string;
  taskId: string;
  label: string;
  status: 'pending' | 'uploaded' | 'approved' | 'rejected';
  fileName?: string;
  uploadedAt?: string;
  dueAt?: string;
  requestedBy: string;
  message?: string;
}

export interface Invite {
  token: string;
  engagementId: string;
  email: string;
  createdAt: string;
  usedAt?: string;
}

export interface ActivityEvent {
  id: string;
  engagementId?: string;
  actor: string;
  verb: string;
  target?: string;
  at: string;
}

/** Empty by default — projects come from Supabase or user-created local state. */
export const seedEngagements: Engagement[] = [];

// Map each starting phase to which buckets are completed, active, or upcoming.
// Operational Readiness = Phase 4 registrations (statutory bucket).
const PHASE_BUCKET_PLAN: Record<Engagement['stage'], {
  completed: Array<'pre-inc' | 'post-inc' | 'fema' | 'statutory'>;
  active: Array<'pre-inc' | 'post-inc' | 'fema' | 'statutory'>;
}> = {
  'Pre-Incorporation':   { completed: [],                      active: ['pre-inc'] },
  'Post-Incorporation':  { completed: ['pre-inc'],             active: ['post-inc'] },
  'Operational Readiness': { completed: ['pre-inc', 'post-inc'], active: ['statutory'] },
};

export function seedTasksFor(engagementId: string, stage: Engagement['stage']): TaskInstance[] {
  const plan = PHASE_BUCKET_PLAN[stage];

  // Track per-bucket counters so the first item in an active bucket becomes
  // in-progress, the next is awaiting-client, and the rest stay not-started.
  const activeBucketCounts: Record<string, number> = {};

  return checklist.map((it, i) => {
    let status: StatusCode = 'not-started';

    if (plan.completed.includes(it.bucket)) {
      status = 'completed';
    } else if (plan.active.includes(it.bucket)) {
      const n = activeBucketCounts[it.bucket] ?? 0;
      activeBucketCounts[it.bucket] = n + 1;
      if (n === 0) status = 'in-progress';
      else if (n === 1) status = 'awaiting-client';
      else status = 'not-started';
    }

    return {
      id: `${engagementId}-${it.id}`,
      engagementId,
      checklistKey: it.id,
      status,
      assigneeId: ['tm1', 'tm2', 'tm3'][i % 3],
    };
  });
}

export const seedRequests: DocRequest[] = [];

export const seedActivity: ActivityEvent[] = [];
