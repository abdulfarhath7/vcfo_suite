import 'server-only';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, profiles, tasks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { listScopedEngagementIds } from '@/db/repositories/engagements';
import { isPersonalTodoStepId } from '@/lib/intern/personal-todos';

/**
 * SIDEBAR FOLDS REPOSITORY: the people lists under the staff sidebar's nav rows
 * (prototype StaffSidebarExtras and SuperSidebarExtras).
 *
 * Access, by role:
 *   - manager: the project leads who report to them, each with the open tasks the lead
 *     holds on the manager's own engagements.
 *   - admin and super admin: every manager, each with the number of live engagements they own.
 *   - intern (project lead): no list; "Your manager" is the manager the lead reports to.
 *   - client and developer: nothing, and no query runs.
 *
 * The client list under Clients is not here: the shell draws it from the scoped engagement
 * list the app already holds.
 */

export interface SidebarFoldPerson {
  /** Profile id. */
  id: string;
  /** Route key: a lead's `intern_id` when set (the key the manager team pages use), else the profile id. */
  key: string;
  name: string;
  /** Manager fold: open tasks the lead holds. Admin fold: engagements the manager owns. */
  count: number;
}

export interface SidebarReportsTo {
  id: string;
  name: string;
  email: string;
}

export interface SidebarFolds {
  /** Project leads (manager) or managers (admin, super admin). Empty for other roles. */
  people: SidebarFoldPerson[];
  /** The lead's manager. Null for other roles, or when the lead reports to no one. */
  reportsTo: SidebarReportsTo | null;
}

const EMPTY: SidebarFolds = { people: [], reportsTo: null };

function displayName(name: string | null, email: string): string {
  return name?.trim() || email;
}

async function leadsForManager(ctx: AuthContext): Promise<SidebarFoldPerson[]> {
  const leads = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email, internId: profiles.internId })
    .from(profiles)
    .where(and(eq(profiles.role, 'intern'), eq(profiles.reportsToManagerId, ctx.userId)))
    .orderBy(asc(profiles.name));
  if (leads.length === 0) return [];

  const scope = await listScopedEngagementIds(ctx);
  const open = new Map<string, number>();
  if (scope.length > 0) {
    const rows = await db
      .select({ assignedTo: tasks.assignedTo, stepId: tasks.stepId })
      .from(tasks)
      .where(
        and(
          inArray(tasks.engagementId, scope),
          inArray(
            tasks.assignedTo,
            leads.map((l) => l.id),
          ),
          ne(tasks.status, 'done'),
        ),
      );
    for (const row of rows) {
      if (!row.assignedTo || isPersonalTodoStepId(row.stepId)) continue;
      open.set(row.assignedTo, (open.get(row.assignedTo) ?? 0) + 1);
    }
  }
  return leads.map((l) => ({
    id: l.id,
    key: l.internId?.trim() || l.id,
    name: displayName(l.name, l.email),
    count: open.get(l.id) ?? 0,
  }));
}

async function managersForFirm(): Promise<SidebarFoldPerson[]> {
  const managers = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.role, 'manager'))
    .orderBy(asc(profiles.name));
  if (managers.length === 0) return [];

  const owned = await db
    .select({ managerId: engagements.managerId })
    .from(engagements)
    .where(
      and(
        inArray(
          engagements.managerId,
          managers.map((m) => m.id),
        ),
        isNull(engagements.deletedAt),
      ),
    );
  const clients = new Map<string, number>();
  for (const row of owned) {
    if (row.managerId) clients.set(row.managerId, (clients.get(row.managerId) ?? 0) + 1);
  }
  return managers.map((m) => ({ id: m.id, key: m.id, name: displayName(m.name, m.email), count: clients.get(m.id) ?? 0 }));
}

async function managerOfLead(ctx: AuthContext): Promise<SidebarReportsTo | null> {
  const [me] = await db
    .select({ managerId: profiles.reportsToManagerId })
    .from(profiles)
    .where(eq(profiles.id, ctx.userId))
    .limit(1);
  if (!me?.managerId) return null;
  const [mgr] = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email })
    .from(profiles)
    .where(and(eq(profiles.id, me.managerId), eq(profiles.role, 'manager')))
    .limit(1);
  if (!mgr) return null;
  return { id: mgr.id, name: displayName(mgr.name, mgr.email), email: mgr.email };
}

/** The sidebar's people folds for the signed-in person, scoped by role. */
export async function getSidebarFolds(ctx: AuthContext): Promise<SidebarFolds> {
  if (isFirmWideAdmin(ctx.role)) return { people: await managersForFirm(), reportsTo: null };
  if (ctx.role === 'manager') return { people: await leadsForManager(ctx), reportsTo: null };
  if (ctx.role === 'intern') return { people: [], reportsTo: await managerOfLead(ctx) };
  return EMPTY;
}
