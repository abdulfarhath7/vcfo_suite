/**
 * Console navigation model. Each seat lists its sections (the icon rail) and
 * the pages in each section (the hover panel), prototype MX_GROUPS /
 * MX_PARENTS. Pages are real Next routes; `match` decides which nav item is
 * current for a pathname (default: the href itself and anything below it).
 */
import type { IconName } from '@/components/portal/ui';
import type { Seat } from './runtime';

export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  /** extra path prefixes that belong to this page */
  also?: string[];
}
export interface NavParent {
  key: string;
  label: string;
  icon: IconName;
  kids: NavItem[];
}
export interface NavGroup {
  label: string;
  icon: IconName;
  items: Array<NavItem | NavParent>;
}

export const isParent = (x: NavItem | NavParent): x is NavParent => 'kids' in x;

const M = '/app/manager';

/** Manager (prototype MX_GROUPS, mapped onto the real manager routes). */
const MANAGER: NavGroup[] = [
  {
    label: 'My day',
    icon: 'home',
    items: [
      { key: 'today', label: 'Today', icon: 'home', href: `${M}/dashboard`, also: [`${M}/overview`] },
      { key: 'approvals', label: 'Approvals', icon: 'check', href: `${M}/approvals` },
      { key: 'requests', label: 'Date requests', icon: 'clock', href: `${M}/date-requests` },
      { key: 'work', label: 'My work', icon: 'step', href: `${M}/work` },
    ],
  },
  {
    label: 'Team',
    icon: 'team',
    items: [
      { key: 'leads', label: 'Project leads', icon: 'team', href: `${M}/leads`, also: [`${M}/team`, `${M}/people`] },
      { key: 'load', label: 'Team load', icon: 'gantt', href: `${M}/team-load` },
    ],
  },
  {
    label: 'Book',
    icon: 'grid',
    items: [
      { key: 'clients', label: 'Clients', icon: 'grid', href: `${M}/projects`, also: [`${M}/engagements`] },
      { key: 'incorporation', label: 'Incorporation', icon: 'brief', href: `${M}/incorporation` },
      { key: 'registrations', label: 'Registrations', icon: 'build', href: `${M}/registrations` },
      {
        key: 'compliance',
        label: 'Compliances',
        icon: 'cal',
        kids: [
          { key: 'calendar', label: 'Compliance calendar', icon: 'cal', href: `${M}/compliances/calendar`, also: [`${M}/compliance`] },
          { key: 'filings', label: 'Filings register', icon: 'calc', href: `${M}/compliances/filings` },
        ],
      },
    ],
  },
  {
    label: 'Workspace',
    icon: 'folder',
    items: [
      { key: 'email', label: 'Email', icon: 'mail', href: `${M}/mail` },
      { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', href: `${M}/whatsapp` },
      {
        key: 'docs',
        label: 'Docs',
        icon: 'folder',
        kids: [
          { key: 'vault', label: 'Document vault', icon: 'folder', href: `${M}/vault` },
          { key: 'knowledge', label: 'Knowledge bank', icon: 'lib', href: `${M}/knowledge-bank` },
        ],
      },
      {
        key: 'updates',
        label: 'Updates',
        icon: 'mega',
        kids: [
          { key: 'anns', label: 'Announcements', icon: 'mega', href: `${M}/announcements` },
          { key: 'notes', label: 'Notifications', icon: 'bell', href: `${M}/notifications` },
          { key: 'regulatory', label: 'Regulatory updates', icon: 'globe', href: `${M}/regulatory-updates` },
        ],
      },
    ],
  },
  {
    label: 'Insight',
    icon: 'bolt',
    items: [
      { key: 'analytics', label: 'Analytics', icon: 'bolt', href: `${M}/analytics` },
      { key: 'audit', label: 'Audit log', icon: 'hist', href: `${M}/audit-log` },
      { key: 'settings', label: 'Settings', icon: 'gear', href: `${M}/settings` },
    ],
  },
];

const L = '/app/intern';

/**
 * Project lead. The prototype's lead desk (a59_lead.js: Today, Clients, Tasks, Filings queue,
 * Registrations, Reviews, Calendar, Team) plus every page the live tool gives a lead
 * (client / step / documents / board resolution, compliances, mail, vault, knowledge bank,
 * updates, analytics, audit log, settings). Pages shared with the manager are the same components.
 */
const LEAD: NavGroup[] = [
  {
    label: 'My day',
    icon: 'home',
    items: [
      { key: 'today', label: 'Today', icon: 'home', href: `${L}/today` },
      { key: 'tasks', label: 'Tasks', icon: 'step', href: `${L}/tasks`, also: [`${L}/requests`] },
      { key: 'reviews', label: 'Reviews', icon: 'check', href: `${L}/reviews` },
    ],
  },
  {
    label: 'Book',
    icon: 'grid',
    items: [
      { key: 'clients', label: 'Clients', icon: 'grid', href: `${L}/clients`, also: [`${L}/projects`, `${L}/engagements`] },
      { key: 'incorporation', label: 'Incorporation', icon: 'brief', href: `${L}/incorporation` },
      { key: 'registrations', label: 'Registrations', icon: 'build', href: `${L}/registrations` },
      {
        key: 'compliance',
        label: 'Compliances',
        icon: 'cal',
        kids: [
          { key: 'calendar', label: 'Compliance calendar', icon: 'cal', href: `${L}/compliances/calendar`, also: [`${L}/compliance`] },
          { key: 'filings', label: 'Filings register', icon: 'calc', href: `${L}/compliances/filings` },
        ],
      },
    ],
  },
  {
    label: 'Team',
    icon: 'team',
    items: [{ key: 'team', label: 'Team', icon: 'team', href: `${L}/team` }],
  },
  {
    label: 'Workspace',
    icon: 'folder',
    items: [
      { key: 'email', label: 'Email', icon: 'mail', href: `${L}/mail` },
      { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', href: `${L}/whatsapp` },
      {
        key: 'docs',
        label: 'Docs',
        icon: 'folder',
        kids: [
          { key: 'vault', label: 'Document vault', icon: 'folder', href: `${L}/vault` },
          { key: 'knowledge', label: 'Knowledge bank', icon: 'lib', href: `${L}/knowledge-bank` },
        ],
      },
      {
        key: 'updates',
        label: 'Updates',
        icon: 'mega',
        kids: [
          { key: 'anns', label: 'Announcements', icon: 'mega', href: `${L}/announcements` },
          { key: 'notes', label: 'Notifications', icon: 'bell', href: `${L}/notifications` },
        ],
      },
    ],
  },
  {
    label: 'Insight',
    icon: 'bolt',
    items: [
      { key: 'analytics', label: 'Analytics', icon: 'bolt', href: `${L}/analytics` },
      { key: 'audit', label: 'Audit log', icon: 'hist', href: `${L}/audit-log` },
      { key: 'settings', label: 'Settings', icon: 'gear', href: `${L}/settings` },
    ],
  },
];

export const SEAT_NAV: Partial<Record<Seat, NavGroup[]>> = { mgr: MANAGER, lead: LEAD };

/** Every leaf page of a seat, in nav order. */
export function navLeaves(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items.flatMap((x) => (isParent(x) ? x.kids : [x])));
}

/** The nav item a pathname belongs to: the longest matching href / `also` prefix. */
export function activeLeaf(groups: NavGroup[], pathname: string): NavItem | undefined {
  const p = pathname.replace(/\/+$/, '');
  let best: { item: NavItem; len: number } | undefined;
  for (const item of navLeaves(groups)) {
    for (const pre of [item.href, ...(item.also ?? [])]) {
      if ((p === pre || p.startsWith(pre + '/')) && (!best || pre.length > best.len)) best = { item, len: pre.length };
    }
  }
  return best?.item;
}

/** The section (rail group) that holds a nav item. */
export function groupOf(groups: NavGroup[], key: string | undefined): NavGroup | undefined {
  if (!key) return undefined;
  return groups.find((g) => g.items.some((x) => (isParent(x) ? x.kids.some((k) => k.key === key) : x.key === key)));
}
