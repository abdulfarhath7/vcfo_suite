import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { tasks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { StatusCode } from '@/data/checklist';
import type { TaskInstance } from '@/data/engagements';
import {
  assertEngagementAccess,
  listEngagements,
} from '@/db/repositories/engagements';
import {
  engagementDbId,
  LEGACY_ENGAGEMENT_IDS,
} from '@/lib/legacy-engagement-ids';

/**
 * TASKS REPOSITORY — replaces vcfo.tasks localStorage.
 *
 * Access (product default, no original RLS):
 *   admin: all
 *   manager: via owned engagements (manager_id / legacy admin_id)
 *   intern/client: rows whose engagement is in their scoped list
 */

type Row = typeof tasks.$inferSelect;

const APP_TO_DB_STATUS: Partial<Record<StatusCode, string>> = {
  'not-started': 'open',
  'in-progress': 'in-progress',
  completed: 'done',
  'awaiting-client': 'open',
  overdue: 'open',
  'not-applicable': 'open',
};

function dbStatusToApp(status: string): StatusCode {
  if (status === 'open') return 'not-started';
  if (status === 'in-progress') return 'in-progress';
  if (status === 'done') return 'completed';
  const known: StatusCode[] = [
    'not-started',
    'in-progress',
    'awaiting-client',
    'completed',
    'overdue',
    'not-applicable',
  ];
  return (known as string[]).includes(status) ? (status as StatusCode) : 'not-started';
}

function appStatusToDb(status: StatusCode | string): string {
  return APP_TO_DB_STATUS[status as StatusCode] ?? status;
}

function appEngagementId(dbId: string | null): string {
  if (!dbId) return '';
  return LEGACY_ENGAGEMENT_IDS[dbId] ?? dbId;
}

export function toAppTask(row: Row): TaskInstance {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    checklistKey: row.stepId ?? '',
    status: dbStatusToApp(row.status),
    assigneeId: row.assignedTo ?? undefined,
    dueAt: row.deadline ? row.deadline.toISOString() : undefined,
    notes: row.description ?? undefined,
  };
}

async function scopedEngagementIds(ctx: AuthContext): Promise<string[] | 'all'> {
  if (ctx.role === 'admin') return 'all';
  const rows = await listEngagements(ctx);
  return rows.map((r) => r.id);
}

export async function listTasks(ctx: AuthContext): Promise<TaskInstance[]> {
  const scope = await scopedEngagementIds(ctx);
  if (scope !== 'all' && scope.length === 0) return [];

  const rows =
    scope === 'all'
      ? await db.select().from(tasks).orderBy(desc(tasks.updatedAt))
      : await db
          .select()
          .from(tasks)
          .where(inArray(tasks.engagementId, scope))
          .orderBy(desc(tasks.updatedAt));

  return rows.map(toAppTask);
}

export async function getTaskById(
  ctx: AuthContext,
  id: string,
): Promise<TaskInstance | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) return null;
  if (row.engagementId) {
    const access = await assertEngagementAccess(ctx, row.engagementId);
    if (!access.ok) return null;
  } else if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    return null;
  }
  return toAppTask(row);
}

export interface CreateTaskInput {
  engagementId: string;
  title?: string;
  checklistKey?: string;
  status?: StatusCode;
  assigneeId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}

export async function createTask(
  ctx: AuthContext,
  input: CreateTaskInput,
): Promise<TaskInstance> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not create tasks');
  }
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) throw new Error('Engagement not found or not permitted');

  const title = input.title?.trim() || input.checklistKey?.trim() || 'Task';
  const [row] = await db
    .insert(tasks)
    .values({
      engagementId: access.dbId,
      title,
      stepId: input.checklistKey ?? null,
      status: appStatusToDb(input.status ?? 'not-started'),
      assignedTo: input.assigneeId ?? null,
      deadline: input.dueAt ? new Date(input.dueAt) : null,
      description: input.notes ?? null,
    })
    .returning();
  return toAppTask(row);
}

export async function updateTask(
  ctx: AuthContext,
  id: string,
  patch: Partial<TaskInstance>,
): Promise<TaskInstance | null> {
  const existing = await getTaskById(ctx, id);
  if (!existing) return null;
  if (ctx.role === 'client') {
    throw new Error('Clients may not update tasks');
  }

  const [row] = await db
    .update(tasks)
    .set({
      ...(patch.checklistKey !== undefined ? { stepId: patch.checklistKey } : {}),
      ...(patch.status !== undefined ? { status: appStatusToDb(patch.status) } : {}),
      ...(patch.assigneeId !== undefined ? { assignedTo: patch.assigneeId ?? null } : {}),
      ...(patch.dueAt !== undefined
        ? { deadline: patch.dueAt ? new Date(patch.dueAt) : null }
        : {}),
      ...(patch.notes !== undefined ? { description: patch.notes ?? null } : {}),
      ...(patch.engagementId !== undefined
        ? { engagementId: engagementDbId(patch.engagementId) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();
  return row ? toAppTask(row) : null;
}
