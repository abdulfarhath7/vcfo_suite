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

/** One before → after line the admin sees before deciding. */
type ChangeRequestPreviewField = {
  label: string;
  from: string;
  to: string;
};

export type ChangeRequestPreview = {
  companyName?: string;
  fields?: ChangeRequestPreviewField[];
};

/** Empty string reads better than "—" inside a diff cell the admin scans. */
export function changeRequestDiffValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'Not set';
}
