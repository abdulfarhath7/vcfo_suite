import { getItem } from '@/data/checklist';
import type { Role } from '@/lib/auth';
import { roleHomePath } from '@/lib/auth-routes';
import { adminProjectPath, adminProjectStepPath, internEngagementPath, internEngagementStepPath } from '@/lib/projects/project-step-path';

/**
 * Where "Fix in Suite" in the VCFO Assist side panel lands: the engagement's checklist step page in
 * the shell the signed-in role can open. The extension does not know the role, so it opens
 * `GET /api/assist/step-link/[id]?step=` and Suite redirects here.
 *
 *   project lead (intern)   /app/lead/engagements/{slug}/step/{stepSlug}
 *   manager                 /app/manager/projects/{slug}/step/{stepSlug}
 *   admin and super admin   /app/admin/projects/{slug}/step/{stepSlug}   (super has no project routes)
 *
 * An unknown step id opens the engagement's own page instead; any other role goes home.
 */
export function assistStepPath(role: Role, project: { slug?: string | null; id: string }, stepId?: string | null): string {
  const target = { slug: project.slug ?? undefined, id: project.id };
  const step = stepId ? getItem(stepId) : undefined;
  if (role === 'intern') return step ? internEngagementStepPath(target, step.id) : internEngagementPath(target);
  if (role === 'manager' || role === 'admin' || role === 'super_admin') {
    const base = role === 'manager' ? 'manager' : 'admin';
    return step ? adminProjectStepPath(target, step.id, base) : adminProjectPath(target, base);
  }
  return roleHomePath(role);
}

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where "Open in Suite" lands while the side panel waits for the certifier's checks (SAFETY.md
 * G17): the staff Assist runs page with that run's detail open, so the certifier can record the
 * checks. `GET /api/assist/step-link/[id]?run=<runId>`. Null for a role with no such page or a
 * malformed run id; the route then falls back to the step link.
 */
export function assistRunPath(role: Role, runId: string | null | undefined): string | null {
  if (!runId || !RUN_ID.test(runId)) return null;
  const base = role === 'super_admin' ? 'super' : role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : role === 'intern' ? 'intern' : null;
  return base ? `/app/${base}/assist-runs?run=${runId.toLowerCase()}` : null;
}
