/**
 * Who may change what on a project.
 *
 * Firm admins act directly on everything. Project managers edit the low-risk
 * details of their own projects directly, but three actions — deleting the
 * project, swapping the client, and reassigning the project manager — go to an
 * admin as a change request first. That split mirrors the rule already enforced
 * server-side by `manager_reassign_admin_only` in the engagement PATCH route.
 *
 * Pure module: no imports from the DB, the session, or React. The API routes
 * remain the enforcement point — this drives the UI and is unit-tested so both
 * sides agree on the same table.
 */

export type ProjectEditAction =
  | 'edit_details'
  | 'change_leads'
  | 'change_manager'
  | 'change_client'
  | 'delete_project'
  | 'restore_project';

/** How an actor may perform an action. */
export type ProjectEditAccess = 'direct' | 'request' | 'denied';

export const PROJECT_EDIT_ACTION_LABEL: Record<ProjectEditAction, string> = {
  edit_details: 'Edit project details',
  change_leads: 'Change delivery team',
  change_manager: 'Change project manager',
  change_client: 'Change client',
  delete_project: 'Delete project',
  restore_project: 'Restore project',
};

/** The actions that reach an admin as a change request when a manager asks. */
export const APPROVAL_REQUIRED_ACTIONS: ProjectEditAction[] = [
  'delete_project',
  'change_client',
  'change_manager',
];

function isAdminRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * @param role      the actor's role
 * @param ownsProject whether a manager owns (or is a member of) this project;
 *                  ignored for admins, who reach every project
 */
export function projectEditAccess(
  action: ProjectEditAction,
  role: string | undefined,
  ownsProject = false,
): ProjectEditAccess {
  if (isAdminRole(role)) return 'direct';

  if (role === 'manager') {
    if (!ownsProject) return 'denied';
    // Restoring is only reachable from the admin recycle bin.
    if (action === 'restore_project') return 'denied';
    return APPROVAL_REQUIRED_ACTIONS.includes(action) ? 'request' : 'direct';
  }

  return 'denied';
}

/** True when the actor can start the action at all, directly or by asking. */
export function canAttemptProjectEdit(
  action: ProjectEditAction,
  role: string | undefined,
  ownsProject = false,
): boolean {
  return projectEditAccess(action, role, ownsProject) !== 'denied';
}

export function requiresApproval(
  action: ProjectEditAction,
  role: string | undefined,
  ownsProject = false,
): boolean {
  return projectEditAccess(action, role, ownsProject) === 'request';
}

/** Engagement fields a manager may PATCH directly on their own project. */
export const MANAGER_EDITABLE_FIELDS = [
  'companyName',
  'companyType',
  'entityLegalForm',
  'parentEntityName',
  'parentEntityAddress',
  'parentEntityRegistrationNumber',
  'subsidiaryLegalName',
  'subsidiaryRegisteredAddress',
  'clientName',
  'stage',
  'health',
  'incorporationDate',
  'internId',
] as const;

export type ManagerEditableField = (typeof MANAGER_EDITABLE_FIELDS)[number];

export function isManagerEditableField(field: string): field is ManagerEditableField {
  return (MANAGER_EDITABLE_FIELDS as readonly string[]).includes(field);
}

/**
 * Split a proposed patch into what this actor may write now and what must be
 * requested. Admins get everything in `direct`; a manager's `managerId` change
 * lands in `needsApproval` even though it sits in the same form.
 */
export function splitProjectPatch<T extends Record<string, unknown>>(
  patch: T,
  role: string | undefined,
): { direct: Partial<T>; needsApproval: Partial<T> } {
  const direct: Record<string, unknown> = {};
  const needsApproval: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (isAdminRole(role) || isManagerEditableField(key)) {
      direct[key] = value;
    } else {
      needsApproval[key] = value;
    }
  }
  return { direct: direct as Partial<T>, needsApproval: needsApproval as Partial<T> };
}

/** The action label a button shows, given whether it will ask or act. */
export function projectEditActionLabel(
  action: ProjectEditAction,
  access: ProjectEditAccess,
): string {
  const base = PROJECT_EDIT_ACTION_LABEL[action];
  return access === 'request' ? `Request: ${base.toLowerCase()}` : base;
}
