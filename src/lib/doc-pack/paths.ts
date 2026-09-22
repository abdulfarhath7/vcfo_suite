import type { ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { DocPart } from '@/lib/doc-pack/types';
import {
  adminProjectPath,
  adminProjectStepPath,
  internEngagementPath,
  internEngagementStepPath,
  type StaffPathBase,
} from '@/lib/project-step-path';

/**
 * Document pack URLs — client-safe. `shell` is `'intern'` for the lead's
 * `/app/intern/engagements/…` routes; anything else is a staff base or role
 * resolved by `staffProjectBase`.
 */

export type DocPackShell = 'intern' | StaffPathBase;
export const DOC_PACK_PART_PARAM = 'part';
/** Query param the step page reads to open a section tab by its slug. */
export const STEP_TAB_PARAM = 'tab';

type ProjectRouteTarget = Pick<Engagement, 'slug' | 'id'>;

export function docPackPagePath(project: ProjectRouteTarget, shell: DocPackShell, part?: DocPart): string {
  const base = shell === 'intern' ? internEngagementPath(project) : adminProjectPath(project, shell);
  const path = `${base}/documents`;
  return part ? `${path}?${DOC_PACK_PART_PARAM}=${part}` : path;
}

export function docPackStepPath(
  project: ProjectRouteTarget,
  shell: DocPackShell,
  step: string | ChecklistItem,
  tabId?: string,
): string {
  const path =
    shell === 'intern' ? internEngagementStepPath(project, step) : adminProjectStepPath(project, step, shell);
  return tabId ? `${path}?${STEP_TAB_PARAM}=${encodeURIComponent(tabId)}` : path;
}

export function docPackApiPath(engagementId: string): string {
  return `/api/engagements/${encodeURIComponent(engagementId)}/doc-pack`;
}

export function docPackItemUrl(engagementId: string, itemKey: string, preview = false): string {
  const url = `${docPackApiPath(engagementId)}/${encodeURIComponent(itemKey)}`;
  return preview ? `${url}?preview=1` : url;
}

export function docPackZipUrl(engagementId: string): string {
  return `${docPackApiPath(engagementId)}/zip`;
}

export function parseDocPart(value: string | null | undefined): DocPart | null {
  return value === 'part-a' || value === 'part-b' ? value : null;
}
