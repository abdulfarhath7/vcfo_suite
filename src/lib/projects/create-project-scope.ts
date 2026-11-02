/**
 * Pure create-project assignment rules (admin vs manager).
 * Repository `createProjectWithClient` enforces these against the DB.
 */

export type CreateProjectManagerAssignment = {
  primaryManagerId: string;
  uniqueManagerIds: string[];
};

function uniqueIds(ids: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw?.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Admin / super_admin: first provided manager is primary (required).
 * Manager: always primary = self; extras are co-managers; adminId stays null at insert.
 */
export function resolveCreateProjectManagerAssignment(input: {
  role: string;
  userId: string;
  managerId?: string;
  managerIds?: string[];
}): CreateProjectManagerAssignment {
  const uniqueManagerIds = uniqueIds([...(input.managerIds ?? []), input.managerId]);

  if (input.role === 'manager') {
    const extras = uniqueManagerIds.filter((id) => id !== input.userId);
    return {
      primaryManagerId: input.userId,
      uniqueManagerIds: [input.userId, ...extras],
    };
  }

  const primaryManagerId = uniqueManagerIds[0];
  if (!primaryManagerId) {
    throw new Error('managerId is required when creating as admin');
  }
  return { primaryManagerId, uniqueManagerIds };
}
