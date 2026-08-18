import { ROLE_UI_LABEL, type Role } from '@/lib/auth';

export type DirectoryKind = 'firm' | 'client';

export type DirectoryProject = {
  id: string;
  slug: string;
  companyName: string;
};

export type DirectoryPerson = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  kind: DirectoryKind;
  projects: DirectoryProject[];
};

export type DirectoryKindFilter = 'all' | DirectoryKind;
export type DirectoryRoleFilter = 'all' | Role;

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
  },
): DirectoryPerson[] {
  const q = input.query?.trim().toLowerCase() ?? '';
  const kind = input.kind ?? 'all';
  const role = input.role ?? 'all';
  const projectId = input.projectId?.trim() || 'all';

  return people.filter((person) => {
    if (kind !== 'all' && person.kind !== kind) return false;
    if (role !== 'all' && person.role !== role) return false;
    if (projectId !== 'all' && !person.projects.some((p) => p.id === projectId)) return false;
    if (!q) return true;
    const hay = `${person.name} ${person.email} ${person.projects.map((p) => p.companyName).join(' ')}`.toLowerCase();
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
