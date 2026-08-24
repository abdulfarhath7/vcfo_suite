import { normalizeShellPathname } from '@/components/shell/shell-back';

/** Section chip in the top-bar location trail. */
export type ShellCrumbIcon =
  | 'users'
  | 'folder'
  | 'megaphone'
  | 'bell'
  | 'layout'
  | 'briefcase'
  | 'inbox'
  | 'mail'
  | 'calendar'
  | 'book'
  | 'chart'
  | 'clipboard'
  | 'history'
  | 'settings'
  | 'home';

export type ShellCrumb = {
  parent: string | null;
  /** Real route for the parent; omit/null when the parent is a nav group only (Docs, Updates). */
  parentHref: string | null;
  current: string;
  /** Engagement/project slug or id — resolve to companyName in the shell. */
  currentKey?: string;
  icon: ShellCrumbIcon;
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
  'board-resolution': 'Board Resolution',
};

const PAGE_ICON: Record<string, ShellCrumbIcon> = {
  today: 'layout',
  dashboard: 'layout',
  tasks: 'briefcase',
  clients: 'users',
  engagements: 'users',
  people: 'users',
  team: 'users',
  vault: 'folder',
  documents: 'folder',
  'knowledge-bank': 'book',
  announcements: 'megaphone',
  notifications: 'bell',
  mail: 'mail',
  inbox: 'inbox',
  projects: 'briefcase',
  compliance: 'calendar',
  compliances: 'calendar',
  analytics: 'chart',
  approvals: 'clipboard',
  requests: 'clipboard',
  'audit-log': 'history',
  audit: 'history',
  settings: 'settings',
  incorporation: 'briefcase',
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

function pageIcon(segment: string | undefined, parent: string | null): ShellCrumbIcon {
  if (parent === 'Docs') return 'folder';
  if (parent === 'Updates') {
    return segment === 'notifications' ? 'bell' : 'megaphone';
  }
  if (parent === 'Clients' || segment === 'engagements') return 'users';
  if (parent === 'Projects' || segment === 'projects') return 'briefcase';
  if (!segment) return 'home';
  return PAGE_ICON[segment] ?? 'layout';
}

function roleBase(parts: string[]): string {
  if (parts[0] === 'app' && parts[1]) return `/app/${parts[1]}`;
  return '/app';
}

/** Parent group for Docs / Updates sidebar disclosures. */
export function shellCrumbParent(segment: string | undefined): string | null {
  if (segment === 'vault' || segment === 'knowledge-bank') return 'Docs';
  if (segment === 'announcements' || segment === 'notifications') return 'Updates';
  if (segment === 'engagements') return 'Clients';
  return null;
}

export type ShellCrumbEngagement = {
  id: string;
  slug?: string | null;
  companyName: string;
};

/** Prefer the live company name over a title-cased slug. */
export function resolveShellCrumbCurrent(
  crumb: ShellCrumb,
  engagements: ReadonlyArray<ShellCrumbEngagement>,
): string {
  const key = crumb.currentKey?.trim().toLowerCase();
  if (!key) return crumb.current;
  const match = engagements.find(
    (row) => row.slug?.toLowerCase() === key || row.id.toLowerCase() === key,
  );
  return match?.companyName ?? crumb.current;
}

export function shellBreadcrumb(pathname: string): ShellCrumb {
  const path = normalizeShellPathname(pathname);
  const parts = path.split('/').filter(Boolean);
  // /app/{role}/{page}/...
  const page = parts[2];
  const nested = parts[3];
  const base = roleBase(parts);

  if (page === 'engagements' && nested) {
    return {
      parent: 'Clients',
      parentHref: `${base}/clients`,
      current: titleCase(nested),
      currentKey: nested,
      icon: 'users',
    };
  }
  if (nested && page === 'projects') {
    return {
      parent: 'Projects',
      parentHref: `${base}/projects`,
      current: nested === 'new' ? 'New project' : titleCase(nested),
      currentKey: nested === 'new' ? undefined : nested,
      icon: 'briefcase',
    };
  }
  if (nested && page === 'people') {
    return {
      parent: 'People',
      parentHref: `${base}/people`,
      current: titleCase(nested),
      icon: 'users',
    };
  }
  if (parts[1] === 'client' && page === 'board-resolution') {
    return {
      parent: 'Incorporation',
      parentHref: '/app/client/incorporation',
      current: 'Board Resolution',
      icon: 'briefcase',
    };
  }

  const parent = page === 'engagements' ? null : shellCrumbParent(page);
  return {
    parent,
    parentHref: null,
    current: pageLabel(page),
    icon: pageIcon(page, parent),
  };
}
