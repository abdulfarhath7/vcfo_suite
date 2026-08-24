import { isShellHomePath, normalizeShellPathname, shellRoleHomePath } from '@/components/shell/shell-back';
import { resolveChecklistItemFromStepParam, slugifyCompanyName } from '@/lib/slug';
import {
  internOverviewPhaseForItem,
  internRegistrationHeadingGroups,
} from '@/lib/intern-overview-progress';
import type { ChecklistItem } from '@/data/checklist';

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

export type ShellCrumbSegment = {
  label: string;
  /** Real route; null on the current leaf (aria-current). */
  href: string | null;
  /** Engagement/project slug or id — resolve to companyName in the shell. */
  engagementKey?: string;
};

export type ShellCrumb = {
  icon: ShellCrumbIcon;
  segments: ShellCrumbSegment[];
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
  compliance: 'Compliance calendar',
  tracker: 'Filing tracker',
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

function pageIcon(segment: string | undefined, group: string | null): ShellCrumbIcon {
  if (group === 'Docs') return 'folder';
  if (group === 'Updates') {
    return segment === 'notifications' ? 'bell' : 'megaphone';
  }
  if (group === 'Clients' || segment === 'engagements') return 'users';
  if (group === 'Projects' || segment === 'projects') return 'briefcase';
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

function resolveEngagementLabel(
  key: string | undefined,
  fallback: string,
  engagements: ReadonlyArray<ShellCrumbEngagement>,
): string {
  const normalized = key?.trim().toLowerCase();
  if (!normalized) return fallback;
  const match = engagements.find(
    (row) =>
      row.slug?.toLowerCase() === normalized ||
      row.id.toLowerCase() === normalized ||
      slugifyCompanyName(row.companyName) === normalized,
  );
  return match?.companyName ?? fallback;
}

export function resolveShellCrumbSegments(
  crumb: ShellCrumb,
  engagements: ReadonlyArray<ShellCrumbEngagement>,
): ShellCrumbSegment[] {
  return crumb.segments.map((seg) => ({
    ...seg,
    label: resolveEngagementLabel(seg.engagementKey, seg.label, engagements),
  }));
}

export function resolveShellCrumbCurrent(
  crumb: ShellCrumb,
  engagements: ReadonlyArray<ShellCrumbEngagement>,
): string {
  const segments = resolveShellCrumbSegments(crumb, engagements);
  return segments[segments.length - 1]?.label ?? 'Home';
}

function markLeaf(segments: ShellCrumbSegment[]): ShellCrumbSegment[] {
  if (segments.length === 0) return segments;
  return segments.map((seg, index) =>
    index === segments.length - 1 ? { ...seg, href: null } : seg,
  );
}

function homeSegment(pathname: string): ShellCrumbSegment {
  return { label: 'Home', href: shellRoleHomePath(pathname) };
}

function trail(
  pathname: string,
  icon: ShellCrumbIcon,
  rest: ShellCrumbSegment[],
): ShellCrumb {
  return {
    icon,
    segments: markLeaf([homeSegment(pathname), ...rest]),
  };
}

type PhaseTrail = {
  phaseTitle: string;
  phaseFirstSlug: string | null;
  heading: { label: string; firstSlug: string } | null;
  stepTitle: string;
};

function phaseTrailForItem(item: ChecklistItem, internRoute: boolean): PhaseTrail {
  const phase = internOverviewPhaseForItem(item.id);
  let heading: PhaseTrail['heading'] = null;
  if (internRoute && phase?.id === 'registration-phase-4') {
    const group = internRegistrationHeadingGroups(phase.items).find((entry) =>
      entry.items.some((row) => row.id === item.id),
    );
    const first = group?.items[0];
    if (group && first) heading = { label: group.heading, firstSlug: first.slug };
  }
  return {
    phaseTitle: phase?.title ?? item.title,
    phaseFirstSlug: phase?.items[0]?.slug ?? null,
    heading,
    stepTitle: item.title,
  };
}

function pushPhaseAndStep(
  segs: ShellCrumbSegment[],
  entityHref: string,
  item: ChecklistItem,
  internRoute: boolean,
  leafOverride?: string,
): void {
  const bits = phaseTrailForItem(item, internRoute);
  segs.push({
    label: bits.phaseTitle,
    href: bits.phaseFirstSlug ? `${entityHref}/step/${bits.phaseFirstSlug}` : entityHref,
  });
  if (bits.heading) {
    segs.push({
      label: bits.heading.label,
      href: `${entityHref}/step/${bits.heading.firstSlug}`,
    });
  }
  segs.push({ label: leafOverride ?? bits.stepTitle, href: null });
}

function listForEntityPage(
  parts: string[],
  page: string,
): { label: string; href: string } {
  const base = roleBase(parts);
  if (parts[1] === 'intern' && page === 'engagements') {
    return { label: 'Clients', href: `${base}/clients` };
  }
  if (page === 'engagements' || page === 'projects') {
    return { label: 'Projects', href: `${base}/projects` };
  }
  return { label: pageLabel(page), href: `${base}/${page}` };
}

export function shellBreadcrumb(pathname: string): ShellCrumb {
  const path = normalizeShellPathname(pathname);
  const parts = path.split('/').filter(Boolean);
  const page = parts[2];
  const nested = parts[3];
  const base = roleBase(parts);

  if (isShellHomePath(path)) {
    return { icon: 'home', segments: [{ label: 'Home', href: null }] };
  }

  if ((page === 'engagements' || page === 'projects') && nested) {
    const internRoute = parts[1] === 'intern';
    const list = listForEntityPage(parts, page);
    const entityHref = `${base}/${page}/${nested}`;
    const segs: ShellCrumbSegment[] = [
      { label: list.label, href: list.href },
      {
        label: nested === 'new' ? 'New project' : titleCase(nested),
        href: nested === 'new' ? null : entityHref,
        engagementKey: nested === 'new' ? undefined : nested,
      },
    ];
    const after = parts[4];
    if (nested !== 'new' && after === 'step' && parts[5]) {
      const item = resolveChecklistItemFromStepParam(parts[5]);
      if (item) {
        pushPhaseAndStep(segs, entityHref, item, internRoute);
      } else {
        segs.push({ label: titleCase(parts[5]), href: null });
      }
    } else if (nested !== 'new' && after === 'board-resolution') {
      const draft = resolveChecklistItemFromStepParam('board-resolution-draft');
      if (draft) {
        pushPhaseAndStep(segs, entityHref, draft, internRoute, 'Board Resolution');
      } else {
        segs.push({ label: 'Board Resolution', href: null });
      }
    }
    return trail(path, internRoute || page === 'engagements' ? 'users' : 'briefcase', segs);
  }

  if (nested && page === 'people') {
    return trail(path, 'users', [
      { label: 'People', href: `${base}/people` },
      { label: titleCase(nested), href: null },
    ]);
  }

  if (parts[1] === 'client' && page === 'board-resolution') {
    const draft = resolveChecklistItemFromStepParam('board-resolution-draft');
    const phase = draft ? internOverviewPhaseForItem(draft.id) : null;
    return trail(path, 'briefcase', [
      { label: 'Incorporation', href: '/app/client/incorporation' },
      {
        label: phase?.title ?? 'SPICe+ Part A',
        href: '/app/client/incorporation',
      },
      { label: 'Board Resolution', href: null },
    ]);
  }

  const group = shellCrumbParent(page);
  if (group === 'Docs') {
    return trail(path, pageIcon(page, group), [
      { label: 'Docs', href: `${base}/vault` },
      { label: pageLabel(page), href: `${base}/${page}` },
    ]);
  }
  if (group === 'Updates') {
    return trail(path, pageIcon(page, group), [
      { label: 'Updates', href: `${base}/announcements` },
      { label: pageLabel(page), href: `${base}/${page}` },
    ]);
  }

  if (nested) {
    const rest: ShellCrumbSegment[] = [
      { label: pageLabel(page), href: `${base}/${page}` },
    ];
    for (let i = 3; i < parts.length; i += 1) {
      const href = i === parts.length - 1 ? null : `/${parts.slice(0, i + 1).join('/')}`;
      rest.push({ label: pageLabel(parts[i]), href });
    }
    return trail(path, pageIcon(page, group), rest);
  }

  return trail(path, pageIcon(page, group), [
    { label: pageLabel(page), href: `${base}/${page}` },
  ]);
}
