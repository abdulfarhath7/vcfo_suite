import type { ActivityDto, ActivityPatchBody } from '@/views/compliances/tasks/api';
import type { TaskVisibility } from '@/views/compliances/tasks/task-model';

/**
 * X-23: the edit form of one activity master row. The route takes notify days (0 to 120),
 * the owner and reviewer roles (up to 120 characters), the visibility of a non-statutory row
 * (a statutory row is always "both"), and the confirm flag of an open point.
 */

export interface ActivityForm {
  notifyDays: string;
  ownerRole: string;
  reviewerRole: string;
  visibility: TaskVisibility;
  confirmed: boolean;
}

export const fromActivity = (a: ActivityDto): ActivityForm => ({
  notifyDays: String(a.notifyDays),
  ownerRole: a.ownerRole,
  reviewerRole: a.reviewerRole,
  visibility: a.visibility,
  confirmed: Boolean(a.confirmedAt),
});

export function activityErrors(f: ActivityForm): Partial<Record<'notifyDays' | 'ownerRole' | 'reviewerRole', string>> {
  const n = Number(f.notifyDays);
  return {
    notifyDays: f.notifyDays.trim() === '' || !Number.isInteger(n) || n < 0 || n > 120 ? 'Use 0 to 120 days' : undefined,
    ownerRole: f.ownerRole.trim().length > 120 ? 'Use 120 characters or fewer' : undefined,
    reviewerRole: f.reviewerRole.trim().length > 120 ? 'Use 120 characters or fewer' : undefined,
  };
}

/** Only the fields that changed, in the route's words. */
export function activityPatchBody(a: ActivityDto, f: ActivityForm): ActivityPatchBody {
  const was = fromActivity(a);
  const body: ActivityPatchBody = {};
  if (Number(f.notifyDays) !== a.notifyDays) body.notifyDays = Number(f.notifyDays);
  if (f.ownerRole.trim() !== was.ownerRole.trim()) body.ownerRole = f.ownerRole.trim();
  if (f.reviewerRole.trim() !== was.reviewerRole.trim()) body.reviewerRole = f.reviewerRole.trim();
  if (a.group === 'non-statutory' && f.visibility !== was.visibility) body.visibility = f.visibility;
  if (a.confirm && f.confirmed !== was.confirmed) body.confirmed = f.confirmed;
  return body;
}

/** The open point state of a row: none, waiting for the owner, or confirmed. */
export function openPointState(a: Pick<ActivityDto, 'confirm' | 'confirmedAt'>): 'none' | 'open' | 'confirmed' {
  if (!a.confirm?.trim()) return 'none';
  return a.confirmedAt ? 'confirmed' : 'open';
}

export const VISIBILITY_LABEL: Record<TaskVisibility, string> = {
  firm: 'Firm only',
  client: 'Client only',
  both: 'Both',
};
