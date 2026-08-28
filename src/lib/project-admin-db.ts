import type { Engagement } from '@/data/engagements';
import type {
  ChangeRequestKind,
  ChangeRequestPreview,
  ChangeRequestStatus,
} from '@/lib/project-change-request-types';
import { apiFetch } from '@/lib/engagements-db';

/** Soft-deleted project as the recycle bin renders it. */
export type DeletedProject = Engagement & { deletedAt: string | null };

export type ChangeRequestDto = {
  id: string;
  engagementId: string;
  kind: ChangeRequestKind;
  status: ChangeRequestStatus;
  requestedBy: string;
  requestedByName: string | null;
  reason: string | null;
  payload: Record<string, unknown>;
  preview: ChangeRequestPreview;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
  companyName?: string | null;
  engagementSlug?: string | null;
};

function engagementPath(appId: string, suffix = ''): string {
  return `/api/engagements/${encodeURIComponent(appId)}${suffix}`;
}

/** Admin only — soft delete. The project vanishes from every scoped read. */
export async function deleteProjectInDb(appId: string): Promise<string> {
  const data = await apiFetch<{ ok: true; deletedId: string }>(engagementPath(appId), {
    method: 'DELETE',
    fallbackError: 'Could not delete the project.',
  });
  return data.deletedId;
}

export async function restoreProjectInDb(appId: string): Promise<Engagement | null> {
  const data = await apiFetch<{ engagement: Engagement | null }>(
    engagementPath(appId, '/restore'),
    { method: 'POST', fallbackError: 'Could not restore the project.' },
  );
  return data.engagement ?? null;
}

export async function listDeletedProjects(): Promise<DeletedProject[]> {
  const data = await apiFetch<{ projects: DeletedProject[] }>('/api/admin/projects/deleted', {
    fallbackError: 'Could not load deleted projects.',
  });
  return data.projects ?? [];
}

export async function listChangeRequestsFromDb(
  statuses: ChangeRequestStatus[] = ['pending'],
): Promise<ChangeRequestDto[]> {
  const query = statuses.length ? `?status=${statuses.join(',')}` : '';
  const data = await apiFetch<{ requests: ChangeRequestDto[] }>(
    `/api/engagement-change-requests${query}`,
    { fallbackError: 'Could not load change requests.' },
  );
  return data.requests ?? [];
}

export async function createChangeRequestInDb(input: {
  engagementId: string;
  kind: ChangeRequestKind;
  payload: Record<string, unknown>;
  preview: ChangeRequestPreview;
  reason?: string;
}): Promise<ChangeRequestDto> {
  const data = await apiFetch<{ request: ChangeRequestDto }>(
    '/api/engagement-change-requests',
    {
      method: 'POST',
      body: JSON.stringify(input),
      fallbackError: 'Could not send the request.',
    },
  );
  return data.request;
}

/** Approving executes the stored payload server-side and returns what it did. */
export async function decideChangeRequestInDb(
  id: string,
  decision: 'approved' | 'rejected' | 'cancelled',
  note?: string,
): Promise<{ request: ChangeRequestDto; applied: { summary: string } | null }> {
  return apiFetch<{ request: ChangeRequestDto; applied: { summary: string } | null }>(
    `/api/engagement-change-requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ decision, note }),
      fallbackError: 'Could not record the decision.',
    },
  );
}

export type EngagementClientRow = {
  userId: string;
  email: string;
  name: string | null;
  memberRole: string;
};

export async function listEngagementClientsFromDb(
  appId: string,
): Promise<EngagementClientRow[]> {
  const data = await apiFetch<{ clients: EngagementClientRow[] }>(
    engagementPath(appId, '/clients'),
    { fallbackError: 'Could not load the client list.' },
  );
  return data.clients ?? [];
}

/** Replace one client on the project with another person (admin/manager direct path). */
export async function substituteClientInDb(
  appId: string,
  input: { replaceUserId: string; email: string; fullName?: string; password: string },
): Promise<{ substituted: { email: string; name: string | null; createdNewUser: boolean } }> {
  return apiFetch(engagementPath(appId, '/clients/substitute'), {
    method: 'POST',
    body: JSON.stringify(input),
    fallbackError: 'Could not change the client.',
  });
}

export type EngagementLeadRow = { internId: string; name: string | null; email: string | null };

export async function listEngagementLeadsFromDb(appId: string): Promise<EngagementLeadRow[]> {
  const data = await apiFetch<{ leads: EngagementLeadRow[] }>(engagementPath(appId, '/leads'), {
    fallbackError: 'Could not load the delivery team.',
  });
  return data.leads ?? [];
}

export async function addEngagementLeadInDb(appId: string, internId: string): Promise<void> {
  await apiFetch(engagementPath(appId, '/leads'), {
    method: 'POST',
    body: JSON.stringify({ internId }),
    fallbackError: 'Could not add that project lead.',
  });
}

export async function removeEngagementLeadInDb(appId: string, internId: string): Promise<void> {
  await apiFetch(engagementPath(appId, '/leads'), {
    method: 'DELETE',
    body: JSON.stringify({ internId }),
    fallbackError: 'Could not remove that project lead.',
  });
}
