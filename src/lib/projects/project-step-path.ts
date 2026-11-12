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

/**
 * Project pages live under admin / manager shells only.
 * Super Admin has no `/app/super/projects/*` routes — use the firm admin shell.
 */
export function staffProjectBase(
  baseOrRole?: StaffPathBase,
): '/app/admin' | '/app/manager' {
  const base = resolveStaffBase(baseOrRole);
  return base === '/app/manager' ? '/app/manager' : '/app/admin';
}

/** Prefer the current shell so Super Admin stays on admin/manager project routes. */
export function staffProjectBaseFromPathname(
  pathname: string | null | undefined,
  role?: StaffPathBase,
): '/app/admin' | '/app/manager' {
  const seg = pathname?.split('/')[2];
  if (seg === 'manager') return '/app/manager';
  if (seg === 'admin' || seg === 'super') return '/app/admin';
  return staffProjectBase(role);
}

export function staffNewProjectPath(baseOrRole?: StaffPathBase): string {
  return `${staffProjectBase(baseOrRole)}/projects/new`;
}

/** Staff (admin/manager) project detail path (prefers slug). */
export function adminProjectPath(
  project: ProjectRouteTarget,
  baseOrRole?: StaffPathBase,
): string {
  const base = staffProjectBase(baseOrRole);
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
  return /^\/app\/lead\/engagements\/[^/]+/.test(pathname);
}

/** True for intern checklist step detail (`…/engagements/{id}/step/…`). */
export function isInternEngagementStepPathname(pathname: string): boolean {
  return /^\/app\/lead\/engagements\/[^/]+\/step(?:\/|$)/.test(pathname);
}

/** Intern engagement detail (slug when available, else id / UUID). */
export function internEngagementPath(project: ProjectRouteTarget): string {
  return `/app/lead/engagements/${project.slug ?? project.id}`;
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

/**
 * Client incorporation checklist. `?step=` still works as a deep link from
 * email — the phase list opens the phase that owns that step.
 */
export function clientIncorporationPath(itemId?: string): string {
  const base = '/app/client/incorporation';
  const id = itemId?.trim();
  return id ? `${base}?step=${encodeURIComponent(id)}` : base;
}

/**
 * Client checklist step workspace. Mirrors `internEngagementStepPath` so the
 * client and the lead open the same screen for the same step; the client has
 * exactly one engagement, so there is no `{id}` segment to carry.
 */
export function clientIncorporationStepPath(step: string | ChecklistItem): string {
  const stepSlug = typeof step === 'string' ? stepSlugForItemId(step) : step.slug;
  return `/app/client/incorporation/step/${stepSlug}`;
}

/** True for the client checklist step workspace (`/app/client/incorporation/step/…`). */
export function isClientIncorporationStepPathname(pathname: string): boolean {
  return /^\/app\/client\/incorporation\/step(?:\/|$)/.test(pathname);
}

/**
 * Added to a notification's link (GL-01). The step page that opens with it moves to the step's
 * card and highlights it for two seconds (`useNotifiedHighlight`).
 */
export const NOTIFIED_HASH = '#notified';

/**
 * GL-01: added to the nearest page the app opens when the person may not open the step a link
 * names (not on the project's team, or the project is gone). The page then says why.
 */
export const NOT_PERMITTED_HASH = '#not-permitted';

/** The project overview for a role: where an old notification without a step link opens (GL-01). */
export function projectPathForRole(role: string, project: ProjectRouteTarget): string {
  if (role === 'client') return clientIncorporationPath();
  if (role === 'intern') return internEngagementPath(project);
  return adminProjectPath(project, role === 'manager' ? 'manager' : 'admin');
}

/**
 * The exact step page of one role (GL-01): the notification pop-up, the notification list, the
 * email and the realtime toast all build their target here, so "Open" lands on the step the
 * notification names, not on a project home. `boardResolution` picks the board resolution page
 * for the lead and the client, where that step lives.
 */
export function stepPathForRole(
  role: string,
  project: ProjectRouteTarget,
  itemId: string,
  options?: { boardResolution?: boolean },
): string {
  const path =
    role === 'client'
      ? options?.boardResolution
        ? clientBoardResolutionPath()
        : clientIncorporationStepPath(itemId)
      : role === 'intern'
        ? options?.boardResolution
          ? internBoardResolutionPath(project)
          : internEngagementStepPath(project, itemId)
        : adminProjectStepPath(project, itemId, role === 'manager' ? 'manager' : 'admin');
  return `${path}${NOTIFIED_HASH}`;
}
