import { ROLE_UI_LABEL, type Role } from '@/lib/auth';

export type DirectoryKind = 'firm' | 'client';
export type DirectoryStatus = 'active' | 'inactive';

export type DirectoryProject = {
  id: string;
  slug: string;
  companyName: string;
  clientEmail?: string | null;
  clientUserId?: string | null;
};

export type DirectoryPerson = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  kind: DirectoryKind;
  status: DirectoryStatus;
  reportsToManagerId: string | null;
  managerName: string | null;
  projects: DirectoryProject[];
  /** Engagement ids where this person is the primary/owner client. */
  primaryForProjectIds?: string[];
};

export type DirectoryKindFilter = 'all' | DirectoryKind;
export type DirectoryRoleFilter = 'all' | Role;
export type DirectoryStatusFilter = 'all' | DirectoryStatus;

export function directoryKindLabel(kind: DirectoryKind): string {
  return kind === 'firm' ? 'Firm' : 'Client';
}

export function directoryRoleLabel(role: Role): string {
  return ROLE_UI_LABEL[role] ?? role;
}

export function kindForRole(role: Role): DirectoryKind {
  return role === 'client' ? 'client' : 'firm';
}

export function filterDirectoryPeople(
  people: DirectoryPerson[],
  input: {
    query?: string;
    kind?: DirectoryKindFilter;
    role?: DirectoryRoleFilter;
    projectId?: string;
    managerId?: string;
    status?: DirectoryStatusFilter;
  },
): DirectoryPerson[] {
  const q = input.query?.trim().toLowerCase() ?? '';
  const kind = input.kind ?? 'all';
  const role = input.role ?? 'all';
  const projectId = input.projectId?.trim() || 'all';
  const managerId = input.managerId?.trim() || 'all';
  const status = input.status ?? 'active';

  return people.filter((person) => {
    const personStatus = person.status ?? 'active';
    if (kind !== 'all' && person.kind !== kind) return false;
    if (role !== 'all' && person.role !== role) return false;
    if (status !== 'all' && personStatus !== status) return false;
    if (projectId !== 'all' && !person.projects.some((p) => p.id === projectId)) return false;
    if (managerId !== 'all') {
      const onTeam = person.reportsToManagerId === managerId || person.userId === managerId;
      if (!onTeam) return false;
    }
    if (!q) return true;
    const hay = `${person.name} ${person.email}`.toLowerCase();
    return hay.includes(q);
  });
}

export function uniqueDirectoryProjects(people: DirectoryPerson[]): DirectoryProject[] {
  const out: DirectoryProject[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    for (const project of person.projects) {
      if (seen.has(project.id)) continue;
      seen.add(project.id);
      out.push(project);
    }
  }
  return out.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export function uniqueDirectoryManagers(
  people: DirectoryPerson[],
): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  for (const person of people) {
    const id = person.reportsToManagerId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: person.managerName?.trim() || 'Project manager',
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Client contacts to put in To when a company is picked.
 * Prefers active client-role / primary-owner people on that engagement.
 * Falls back to any client contact with an email (including inactive).
 */
export function clientRecipientsForProject(
  people: DirectoryPerson[],
  projectId: string,
): DirectoryPerson[] {
  const id = projectId.trim();
  if (!id || id === 'all') return [];

  const onProject = people.filter((person) => {
    if (!person.email?.trim()) return false;
    const onEngagement = person.projects.some((p) => p.id === id);
    if (!onEngagement) return false;
    const isClient = person.kind === 'client' || (person.primaryForProjectIds ?? []).includes(id);
    return isClient;
  });

  const active = onProject.filter((person) => (person.status ?? 'active') === 'active');
  const chosen = active.length > 0 ? active : onProject;

  return [...chosen].sort((a, b) => {
    const aPri = (a.primaryForProjectIds ?? []).includes(id) ? 0 : 1;
    const bPri = (b.primaryForProjectIds ?? []).includes(id) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return a.name.localeCompare(b.name);
  });
}

/** Match `?to=` on staff compose to a directory person (email or user id). */
export function matchDirectoryPersonByToParam(
  people: Array<Pick<DirectoryPerson, 'userId' | 'email'>>,
  to: string | null | undefined,
): string | null {
  const raw = to?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const match = people.find(
    (person) => person.userId === raw || person.email.trim().toLowerCase() === lower,
  );
  return match?.userId ?? null;
}
