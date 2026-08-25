import type { DirectoryPerson } from '@/lib/email/directory-filter';

export type LeadManager = {
  id: string;
  name: string;
  email: string;
};

export type LeadManagerEngagement = {
  managerId?: string | null;
  managerIds?: string[] | null;
};

export function collectLeadManagerIds(
  engagements: LeadManagerEngagement[],
  reportsToManagerId?: string | null,
): string[] {
  const ids = new Set<string>();
  const reportsTo = reportsToManagerId?.trim();
  if (reportsTo) ids.add(reportsTo);
  for (const engagement of engagements) {
    const primary = engagement.managerId?.trim();
    if (primary) ids.add(primary);
    for (const id of engagement.managerIds ?? []) {
      const trimmed = id?.trim();
      if (trimmed) ids.add(trimmed);
    }
  }
  return [...ids];
}

function toLeadManager(person: Pick<DirectoryPerson, 'userId' | 'name' | 'email'>): LeadManager | null {
  const email = person.email.trim();
  if (!email) return null;
  return {
    id: person.userId,
    name: person.name.trim() || email,
    email,
  };
}

/**
 * Managers for a project lead: reports-to plus PMs on assigned companies.
 * `people` must be intern-scoped (GET /api/outlook/directory).
 */
export function resolveLeadManagers(
  engagements: LeadManagerEngagement[],
  people: DirectoryPerson[],
  reportsToManagerId?: string | null,
): LeadManager[] {
  const wanted = new Set(collectLeadManagerIds(engagements, reportsToManagerId));
  const out: LeadManager[] = [];
  const seen = new Set<string>();

  const push = (person: DirectoryPerson | undefined) => {
    if (!person || person.status === 'inactive' || seen.has(person.userId)) return;
    if (person.role !== 'manager') return;
    const row = toLeadManager(person);
    if (!row) return;
    seen.add(person.userId);
    out.push(row);
  };

  const byId = new Map(people.map((person) => [person.userId, person]));
  for (const id of wanted) push(byId.get(id));

  // Directory already includes reports-to + engagement_managers when JWT has
  // no reportsToManagerId and client engagements only expose primary managerId.
  for (const person of people) {
    if (wanted.has(person.userId)) continue;
    push(person);
  }

  return out.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}

export function internManagerComposeHref(email: string): string {
  const to = email.trim();
  return to ? `/app/intern/mail?to=${encodeURIComponent(to)}` : '/app/intern/mail';
}
