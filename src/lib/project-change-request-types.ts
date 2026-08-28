/**
 * Shared change-request vocabulary. Lives outside the repository layer so the
 * client bundle can import these without pulling in `server-only`.
 */

/** The three high-risk actions a manager may not perform unilaterally. */
export const CHANGE_REQUEST_KINDS = ['delete_project', 'change_client', 'change_manager'] as const;
export type ChangeRequestKind = (typeof CHANGE_REQUEST_KINDS)[number];

export const CHANGE_REQUEST_KIND_LABEL: Record<ChangeRequestKind, string> = {
  delete_project: 'Delete project',
  change_client: 'Change client',
  change_manager: 'Change project manager',
};

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const CHANGE_REQUEST_STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
};

/** One before → after line the admin sees before deciding. */
export type ChangeRequestPreviewField = {
  label: string;
  from: string;
  to: string;
};

export type ChangeRequestPreview = {
  companyName?: string;
  fields?: ChangeRequestPreviewField[];
};

export function isChangeRequestKind(value: string): value is ChangeRequestKind {
  return (CHANGE_REQUEST_KINDS as readonly string[]).includes(value);
}

export function isChangeRequestStatus(value: string): value is ChangeRequestStatus {
  return ['pending', 'approved', 'rejected', 'cancelled'].includes(value);
}

/** Empty string reads better than "—" inside a diff cell the admin scans. */
export function changeRequestDiffValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'Not set';
}
