import { normalizeShellPathname } from '@/components/shell/shell-back';

export type ShellCrumb = {
  parent: string | null;
  current: string;
};

const PAGE_LABEL: Record<string, string> = {
  today: 'Today',
  tasks: 'My work',
  clients: 'Clients',
  vault: 'Vault',
  'knowledge-bank': 'Knowledge Bank',
  announcements: 'Announcements',
  notifications: 'Notifications',
  mail: 'Send email',
  requests: 'Requests',
  compliance: 'Compliance calendar',
  compliances: 'Compliances',
  analytics: 'Analytics',
  'audit-log': 'Audit Log',
  audit: 'Activity audit',
  dashboard: 'Home',
  projects: 'Projects',
  people: 'People',
  approvals: 'Approvals',
  team: 'Team',
  inbox: 'Inbox',
  incorporation: 'Incorporation',
  documents: 'Documents',
  settings: 'Account',
  engagements: 'Clients',
};

function titleCase(segment: string): string {
  return segment
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function pageLabel(segment: string | undefined): string {
  if (!segment) return 'Home';
  return PAGE_LABEL[segment] ?? titleCase(segment);
}

/** Parent group for Docs / Updates sidebar disclosures. */
export function shellCrumbParent(segment: string | undefined): string | null {
  if (segment === 'vault' || segment === 'knowledge-bank') return 'Docs';
  if (segment === 'announcements' || segment === 'notifications') return 'Updates';
  if (segment === 'engagements') return 'Clients';
  return null;
}

export function shellBreadcrumb(pathname: string): ShellCrumb {
  const path = normalizeShellPathname(pathname);
  const parts = path.split('/').filter(Boolean);
  // /app/{role}/{page}/...
  const page = parts[2];
  const nested = parts[3];
  if (page === 'engagements' && nested) {
    return { parent: 'Clients', current: titleCase(nested) };
  }
  if (nested && page === 'projects') {
    return { parent: 'Projects', current: titleCase(nested) };
  }
  if (nested && page === 'people') {
    return { parent: 'People', current: titleCase(nested) };
  }
  return {
    parent: shellCrumbParent(page),
    current: pageLabel(page),
  };
}
