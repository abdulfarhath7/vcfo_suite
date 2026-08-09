import type { Engagement } from '@/data/engagements';
import type { ChecklistItem } from '@/data/checklist';
import type { Role } from '@/lib/auth';
import { staffBasePathForRole, type StaffBasePath } from '@/lib/auth-routes';
import { stepSlugForItemId } from '@/lib/slug';

type ProjectRouteTarget = Pick<Engagement, 'slug' | 'id'>;

export type StaffPathBase = StaffBasePath | Role;

function resolveStaffBase(baseOrRole?: StaffPathBase): StaffBasePath {
  if (
    baseOrRole === '/app/admin' ||
    baseOrRole === '/app/manager' ||
    baseOrRole === '/app/super'
  ) {
    return baseOrRole;
  }
  return staffBasePathForRole(baseOrRole);
}

/** Staff (admin/manager) project detail path (prefers slug). */
export function adminProjectPath(
  project: ProjectRouteTarget,
  baseOrRole?: StaffPathBase,
): string {
  const base = resolveStaffBase(baseOrRole);
  return `${base}/projects/${project.slug ?? project.id}`;
}

/** Staff project checklist step detail */
export function adminProjectStepPath(
  project: ProjectRouteTarget,
  step: string | ChecklistItem,
  baseOrRole?: StaffPathBase,
): string {
  const stepSlug =
    typeof step === 'string' ? stepSlugForItemId(step) : step.slug;
  return `${adminProjectPath(project, baseOrRole)}/step/${stepSlug}`;
}

/** True for intern engagement detail, step, and board-resolution URLs. */
export function isInternEngagementPathname(pathname: string): boolean {
  return /^\/app\/intern\/engagements\/[^/]+/.test(pathname);
}

/** Intern engagement detail (slug when available, else id / UUID). */
export function internEngagementPath(project: ProjectRouteTarget): string {
  return `/app/intern/engagements/${project.slug ?? project.id}`;
}

/** Intern checklist step detail */
export function internEngagementStepPath(
  project: ProjectRouteTarget,
  step: string | ChecklistItem,
): string {
  const stepSlug =
    typeof step === 'string' ? stepSlugForItemId(step) : step.slug;
  return `${internEngagementPath(project)}/step/${stepSlug}`;
}

/** Intern board resolution editor */
export function internBoardResolutionPath(project: ProjectRouteTarget): string {
  return `${internEngagementPath(project)}/board-resolution`;
}

/** Client read-only board resolution */
export function clientBoardResolutionPath(): string {
  return '/app/client/board-resolution';
}
