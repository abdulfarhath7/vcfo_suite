/**
 * Personal todos (LeadFocusCard) — Path A visibility helpers.
 *
 * Rows live on `tasks` with `engagement_id` null, `assigned_to` = owner,
 * and `step_id` prefixed `todo:` so they stay out of engagement TaskInstance lists.
 */
import { CUSTOM_INTERN_FOCUS_PREFIX, INTERN_FOCUS_TITLE_MAX, isCustomInternFocus } from '@/lib/intern-work';
import type { InternFocusEntry } from '@/lib/intern-work';
import { isFirmWideAdmin, type Role } from '@/lib/auth';

export const PERSONAL_TODO_STEP_PREFIX = 'todo:';

export const PERSONAL_TODO_STAFF_ROLES: readonly Role[] = [
  'super_admin',
  'admin',
  'manager',
  'intern',
];

export interface PersonalTodoDto {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerRole: Role;
  title: string;
  done: boolean;
  custom: boolean;
  entryId: string;
  updatedAt: string;
}

export interface PersonalTodoOwnerGroup {
  ownerId: string;
  ownerName: string;
  ownerRole: Role;
  todos: PersonalTodoDto[];
}

export function isPersonalTodoStepId(stepId: string | null | undefined): boolean {
  return Boolean(stepId?.startsWith(PERSONAL_TODO_STEP_PREFIX));
}

export function personalTodoStepId(entryId: string): string {
  return `${PERSONAL_TODO_STEP_PREFIX}${entryId}`;
}

export function entryIdFromPersonalTodoStepId(stepId: string | null | undefined): string | null {
  if (!isPersonalTodoStepId(stepId) || !stepId) return null;
  const entryId = stepId.slice(PERSONAL_TODO_STEP_PREFIX.length).trim();
  return entryId || null;
}

export function canAccessPersonalTodos(role: Role | string | undefined): boolean {
  return role === 'intern' || role === 'manager' || isFirmWideAdmin(role);
}

/** Only the owner may create/update/delete. Higher roles may list, not mutate. */
export function canMutatePersonalTodo(
  viewer: { role: Role | string | undefined; userId: string },
  ownerId: string | null | undefined,
): boolean {
  if (!ownerId || !canAccessPersonalTodos(viewer.role)) return false;
  return viewer.userId === ownerId;
}

export function canListPersonalTodo(args: {
  viewerRole: Role | string | undefined;
  viewerUserId: string;
  todoOwnerId: string;
  /** Manager: self + leads/co-managers on scoped engagements + intern reports. */
  managerVisibleOwnerIds?: readonly string[];
}): boolean {
  if (!canAccessPersonalTodos(args.viewerRole)) return false;
  if (args.viewerRole === 'intern') return args.todoOwnerId === args.viewerUserId;
  if (isFirmWideAdmin(args.viewerRole)) return true;
  if (args.viewerRole === 'manager') {
    return (args.managerVisibleOwnerIds ?? []).includes(args.todoOwnerId);
  }
  return false;
}

export function filterPersonalTodosForViewer<T extends { ownerId: string }>(
  todos: T[],
  viewer: {
    role: Role | string | undefined;
    userId: string;
    managerVisibleOwnerIds?: readonly string[];
  },
): T[] {
  return todos.filter((todo) =>
    canListPersonalTodo({
      viewerRole: viewer.role,
      viewerUserId: viewer.userId,
      todoOwnerId: todo.ownerId,
      managerVisibleOwnerIds: viewer.managerVisibleOwnerIds,
    }),
  );
}

/** Union of owners a project manager may see (always includes self). */
export function managerVisibleTodoOwnerIds(input: {
  managerId: string;
  reportProfileIds?: readonly string[];
  leadProfileIdsOnEngagements?: readonly string[];
  managerProfileIdsOnEngagements?: readonly string[];
}): string[] {
  const ids = new Set<string>([input.managerId]);
  for (const id of input.reportProfileIds ?? []) {
    if (id) ids.add(id);
  }
  for (const id of input.leadProfileIdsOnEngagements ?? []) {
    if (id) ids.add(id);
  }
  for (const id of input.managerProfileIdsOnEngagements ?? []) {
    if (id) ids.add(id);
  }
  return [...ids];
}

export function personalTodoToFocusEntry(todo: PersonalTodoDto): InternFocusEntry {
  return {
    id: todo.entryId,
    done: todo.done,
    custom: todo.custom || undefined,
    title: todo.title,
    dbId: todo.id,
  };
}

export function focusEntryToCreateBody(entry: InternFocusEntry): {
  entryId: string;
  title: string;
  done: boolean;
  custom: boolean;
} {
  const custom = isCustomInternFocus(entry);
  const title = (entry.title ?? '').trim().slice(0, INTERN_FOCUS_TITLE_MAX);
  return {
    entryId: entry.id,
    title: title || (custom ? 'Untitled' : entry.id),
    done: Boolean(entry.done),
    custom,
  };
}

export function groupOpenPersonalTodosByOwner(
  todos: PersonalTodoDto[],
  opts?: { viewerUserId?: string; excludeUserId?: string },
): PersonalTodoOwnerGroup[] {
  const map = new Map<string, PersonalTodoOwnerGroup>();
  for (const todo of todos) {
    if (todo.done) continue;
    if (opts?.excludeUserId && todo.ownerId === opts.excludeUserId) continue;
    const group = map.get(todo.ownerId) ?? {
      ownerId: todo.ownerId,
      ownerName: todo.ownerName,
      ownerRole: todo.ownerRole,
      todos: [],
    };
    group.todos.push(todo);
    map.set(todo.ownerId, group);
  }
  const viewerUserId = opts?.viewerUserId;
  return Array.from(map.values()).sort((a, b) => {
    if (viewerUserId) {
      if (a.ownerId === viewerUserId && b.ownerId !== viewerUserId) return -1;
      if (b.ownerId === viewerUserId && a.ownerId !== viewerUserId) return 1;
    }
    return a.ownerName.localeCompare(b.ownerName);
  });
}

export { CUSTOM_INTERN_FOCUS_PREFIX, INTERN_FOCUS_TITLE_MAX };
