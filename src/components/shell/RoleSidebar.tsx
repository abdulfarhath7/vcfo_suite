'use client';

import { openShortcuts } from '@/components/shell/ShortcutSheet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type TransitionEvent } from 'react';
import { LayoutGroup, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import {
  Keyboard,
  LayoutDashboard,
  Briefcase,
  Building2,
  Inbox,
  UserSquare2,
  FolderClosed,
  BookMarked,
  FolderOpen,
  CalendarCheck,
  BarChart3,
  Landmark,
  Users,
  History as HistoryIcon,
  BookOpen,
  ClipboardCheck,
  ScrollText,
  Mail,
  Pin,
  PanelLeftClose,
  PanelLeftOpen,
  Columns3,
  Megaphone,
  Archive,
  Bell,
  TriangleAlert,
  Layers,
  TrendingUp,
  FileBarChart,
  Settings,
  BadgeCheck,
  Plug,
  Clock,
  Text as TextIcon,
  ShieldCheck,
  Lock,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import { UserFace } from '@/components/common/UserFace';
import { AskLauncher } from '@/components/ask/AskLauncher';
import type { SidebarMode } from '@/context/AppContext';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { useShellNav } from '@/components/shell/shell-nav-context';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { SidebarComplianceMini } from '@/components/shell/SidebarComplianceMini';
import { complianceLeaves } from '@/components/shell/compliance-nav';
import { TONE } from '@/components/shell/nav-tones';
import { InternClientsNav, INTERN_CLIENTS_HREF } from '@/components/shell/InternClientsNav';
import {
  SidebarNavCountBadge,
  SidebarNavGroup,
  SidebarRailBadge,
  SidebarRailLabel,
  SidebarRailUrgentBadge,
  sidebarNavTriggerClass,
  sidebarPillClass,
  sidebarRailClass,
  type SidebarNavLeaf,
} from '@/components/shell/SidebarNavGroup';
import {
  readSavedSidebarMode,
  saveSidebarMode,
  shellDesktopNavExpanded,
  sidebarIsPinned,
  sidebarPinCopy,
  toggleSidebarPin,
} from '@/components/shell/intern-sidebar';
import { useSidebarNarrow, useSidebarPeek, useSidebarPinKey } from '@/components/shell/use-sidebar-peek';
import { MotionActivePill, SidebarHoverGlass, sidebarHoverAttrs, useSidebarHoverFollow } from '@/components/shell/MotionActivePill';
import { roleHomePath, roleSettingsPath } from '@/lib/auth-routes';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { surfaceCssVars } from '@/lib/shell/shell-appearance';

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
  /** Icon color when item is inactive — the "colorful nav" treatment. */
  iconTone?: string;
}

interface NavGroupDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
  items: SidebarNavLeaf[];
}

type NavSectionBreak = { kind: 'break'; id: string };

type NavEntry = Item | NavGroupDef | NavSectionBreak;

/** Hairline before Analytics + Audit Log so they read as a quieter tools cluster. */
const NAV_TOOLS_BREAK: NavSectionBreak = { kind: 'break', id: 'tools' };

function isNavSectionBreak(entry: NavEntry): entry is NavSectionBreak {
  return 'kind' in entry && entry.kind === 'break';
}

function isNavGroup(entry: NavEntry): entry is NavGroupDef {
  return 'items' in entry;
}

function docsGroup(base: string, vaultIcon: Item['icon'] = FolderClosed): NavGroupDef {
  return {
    id: `docs:${base}`,
    label: 'Docs',
    icon: FolderOpen,
    iconTone: TONE.files,
    items: [
      { to: `${base}/vault`, label: 'Vault', icon: vaultIcon, iconTone: TONE.files },
      { to: `${base}/knowledge-bank`, label: 'Knowledge Bank', icon: BookOpen, iconTone: TONE.knowledge },
    ],
  };
}

/** Compliances → Calendar + Filings, the same disclosure shape as Updates — every role. */
function compliancesGroup(base: string): NavGroupDef {
  return {
    id: `compliances:${base}`,
    label: 'Compliances',
    icon: CalendarCheck,
    iconTone: TONE.calendar,
    items: complianceLeaves(base),
  };
}

function updatesGroup(base: string): NavGroupDef {
  return {
    id: `updates:${base}`,
    label: 'Updates',
    icon: Bell,
    iconTone: TONE.news,
    items: [
      { to: `${base}/announcements`, label: 'Announcements', icon: Megaphone, iconTone: TONE.news },
      { to: `${base}/notifications`, label: 'Notifications', icon: Bell, iconTone: TONE.work },
    ],
  };
}

/* Sidebars in priority order (K-15, rule R-32): daily work, dated work, messages,
   documents, then reports and settings below the break. */
const firmAdminItems: NavEntry[] = [
  { to: '/app/admin/dashboard', label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/admin/projects', label: 'Projects', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  compliancesGroup('/app/admin'),
  { to: '/app/admin/registrations', label: 'Registrations', icon: BadgeCheck, iconTone: TONE.work },
  updatesGroup('/app/admin'),
  { to: '/app/admin/mail', label: 'Email', icon: Mail, iconTone: TONE.work },
  docsGroup('/app/admin'),
  NAV_TOOLS_BREAK,
  { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
  { to: '/app/admin/ask-vcfo/sources', label: 'Ask VCFO sources', icon: BookMarked, iconTone: TONE.knowledge },
  { to: '/app/admin/audit-log', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
  { to: '/app/admin/firm-settings', label: 'Firm settings', icon: Settings, iconTone: TONE.audit },
];

const clientItems: NavEntry[] = [
  { to: '/app/client/overview', label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/client/incorporation', label: 'Incorporation', icon: Landmark, iconTone: TONE.work },
  compliancesGroup('/app/client'),
  { to: '/app/client/registrations', label: 'Registrations', icon: BadgeCheck, iconTone: TONE.work },
  updatesGroup('/app/client'),
  { to: '/app/client/documents', label: 'Documents', icon: FolderClosed, iconTone: TONE.files },
  { to: '/app/client/library', label: 'Library', icon: BookMarked, iconTone: TONE.knowledge },
  { to: '/app/client/audit', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
  { to: '/app/client/team', label: 'Team', icon: Users, iconTone: TONE.people },
];

/* Super admin, in the prototype's order (K-45): Overview, Risks, Clients, Practice areas, Team,
   Growth, Reports, then the firm-scope entries the super admin already had, then Firm settings. */
const superAdminItems: NavEntry[] = [
  { to: '/app/super/dashboard', label: 'Overview', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/super/risks', label: 'Risks', icon: TriangleAlert, iconTone: TONE.queue },
  { to: '/app/super/projects', label: 'Clients', icon: Briefcase, iconTone: TONE.work },
  {
    id: 'practice:super',
    label: 'Practice areas',
    icon: Layers,
    iconTone: TONE.work,
    items: [
      { to: '/app/super/practice/incorporation', label: 'Incorporation', icon: Landmark, iconTone: TONE.work },
      { to: '/app/super/practice/registrations', label: 'Registrations', icon: BadgeCheck, iconTone: TONE.work },
      // Firm scope, like Firm / People / Email: super has no compliance routes of its own.
      ...complianceLeaves('/app/admin'),
    ],
  },
  { to: '/app/super/team', label: 'Team', icon: Users, iconTone: TONE.people },
  { to: '/app/super/growth', label: 'Growth', icon: TrendingUp, iconTone: TONE.analytics },
  { to: '/app/super/reports', label: 'Reports', icon: FileBarChart, iconTone: TONE.analytics },
  updatesGroup('/app/super'),
  NAV_TOOLS_BREAK,
  { to: '/app/admin/dashboard', label: 'Firm', icon: Building2, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/mail', label: 'Email', icon: Mail, iconTone: TONE.work },
  { to: '/app/admin/audit-log', label: 'Firm log', icon: HistoryIcon, iconTone: TONE.audit },
  { to: '/app/client/overview', label: 'Portal', icon: Inbox, iconTone: TONE.home },
  { to: '/app/client/audit', label: 'Client log', icon: ScrollText, iconTone: TONE.audit },
  { to: '/app/super/settings', label: 'Firm settings', icon: Settings, iconTone: TONE.audit },
  { to: '/app/dev/overview', label: 'Developer console', icon: Plug, iconTone: TONE.work },
];

/* Developer console (G-01), in the prototype's order. The super admin reaches it from a
   "Developer console" link; a developer sees only these items. */
const developerItems: NavEntry[] = [
  { to: '/app/dev/overview', label: 'Overview', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/dev/connections', label: 'Connections', icon: Plug, iconTone: TONE.work },
  { to: '/app/dev/jobs', label: 'Jobs', icon: Clock, iconTone: TONE.work },
  { to: '/app/dev/logs', label: 'Logs', icon: TextIcon, iconTone: TONE.work },
  { to: '/app/dev/messages', label: 'Messages', icon: Mail, iconTone: TONE.work },
  { to: '/app/dev/deploys', label: 'Deploys', icon: ShieldCheck, iconTone: TONE.work },
  { to: '/app/dev/access', label: 'Access', icon: Lock, iconTone: TONE.people },
  { to: '/app/dev/data', label: 'Data and costs', icon: Database, iconTone: TONE.analytics },
  { to: '/app/dev/audit', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
];

/** Home and Profile for the rail. The developer has no profile page yet, so both open the console. */
function railHomePath(role: Role): string {
  return role === 'developer' ? '/app/dev/overview' : roleHomePath(role);
}
function railProfilePath(role: Role): string {
  return role === 'developer' ? '/app/dev/overview' : roleSettingsPath(role);
}

const InternMyWorkBadge = memo(function InternMyWorkBadge() {
  const { kpis } = useInternPortfolio();
  return <SidebarNavCountBadge count={kpis.action.total} />;
});

const StackedInternWorkBadge = memo(function StackedInternWorkBadge() {
  const { kpis } = useInternPortfolio();
  return <SidebarRailBadge count={kpis.action.total} />;
});

/* R-49: the lead's "needs action" count is the urgent one, so the rail shows it in red. */
const RailInternWorkBadge = memo(function RailInternWorkBadge({ ink }: { ink: 'light' | 'dark' }) {
  const { kpis } = useInternPortfolio();
  return <SidebarRailUrgentBadge count={kpis.action.total} ink={ink} />;
});

function SidebarNavBody({
  expanded,
  onNavigate,
  layoutIdPrefix = 'sidebar',
  mode,
  onTogglePin,
  ink = 'dark',
  stacked = false,
}: {
  expanded: boolean;
  onNavigate?: () => void;
  layoutIdPrefix?: string;
  /** R-49 pin control, desktop only (omit on the phone drawer and under 1100px). */
  mode?: SidebarMode;
  onTogglePin?: () => void;
  ink?: 'light' | 'dark';
  /** Pinned closed: icon over a short label. Hover-peek stays icon-only. */
  stacked?: boolean;
}) {
  const { user, engagements, getStateForEngagement } = useApp();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce, motion: motionStyle } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const staticHover = reduceMotion || motionStyle === 'minimal';
  const { follow: hoverFollow, onLeave: onHoverLeave, navHoverProps } = useSidebarHoverFollow(
    layoutIdPrefix,
    ink,
    staticHover,
  );

  const managerItems = useMemo<NavEntry[]>(
    () => [
      { to: `${staffBase}/dashboard`, label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
      { to: `${staffBase}/projects`, label: 'Projects', icon: Briefcase, iconTone: TONE.work },
      { to: `${staffBase}/approvals`, label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
      { to: `${staffBase}/people`, label: 'People', icon: Users, iconTone: TONE.people },
      { to: `${staffBase}/team`, label: 'Project leads', icon: UserSquare2, iconTone: TONE.people },
      compliancesGroup(staffBase),
      { to: `${staffBase}/registrations`, label: 'Registrations', icon: BadgeCheck, iconTone: TONE.work },
      updatesGroup(staffBase),
      { to: `${staffBase}/mail`, label: 'Email', icon: Mail, iconTone: TONE.work },
      docsGroup(staffBase),
      NAV_TOOLS_BREAK,
      { to: `${staffBase}/analytics`, label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
      { to: `${staffBase}/audit-log`, label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
    ],
    [staffBase],
  );

  // A lead sees Compliances only once at least one of their engagements is
  // incorporated; the pages themselves redirect to Today until then.
  const leadHasCompliances = useMemo(
    () =>
      user?.role === 'intern' &&
      complianceEngagementsForRole('intern', engagements, getStateForEngagement).length > 0,
    [user?.role, engagements, getStateForEngagement],
  );
  const internItems = useMemo<NavEntry[]>(
    () => [
      { to: '/app/intern/today', label: 'Today', icon: LayoutDashboard, iconTone: TONE.home },
      { to: '/app/intern/tasks', label: 'Work', icon: Columns3, iconTone: TONE.work },
      { to: INTERN_CLIENTS_HREF, label: 'Clients', icon: UserSquare2, iconTone: TONE.people },
      ...(leadHasCompliances ? [compliancesGroup('/app/intern')] : []),
      { to: '/app/intern/registrations', label: 'Registrations', icon: BadgeCheck, iconTone: TONE.work },
      updatesGroup('/app/intern'),
      { to: '/app/intern/mail', label: 'Email', icon: Mail, iconTone: TONE.work },
      docsGroup('/app/intern', Archive),
      NAV_TOOLS_BREAK,
      { to: '/app/intern/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
      { to: '/app/intern/audit-log', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
    ],
    [leadHasCompliances],
  );

  if (!user) return null;

  const items =
    user.role === 'super_admin'
      ? superAdminItems
      : user.role === 'admin'
        ? firmAdminItems
        : user.role === 'manager'
          ? managerItems
          : user.role === 'intern'
            ? internItems
            : user.role === 'developer'
              ? developerItems
              : clientItems;

  return (
    <>
      <div
        className={cn(
          'flex h-[var(--shell-rail-height)] shrink-0 items-center',
          expanded ? 'px-3.5' : 'justify-center px-1',
          ink === 'light' ? 'border-b border-side-line' : 'border-b border-line',
        )}
      >
        <Link
          href={railHomePath(user.role)}
          onClick={onNavigate}
          aria-label="VCFO Suite home"
          className={cn(
            'flex min-w-0 items-center rounded-md py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            expanded ? 'gap-2.5 pr-1.5' : 'justify-center',
          )}
        >
          <SbcLogo variant="mark" size={28} decorative />
          <span
            className={cn(
              'truncate text-[13px] font-semibold tracking-tight',
              ink === 'light' ? 'text-side-ink' : 'text-ink',
              !expanded && 'hidden',
            )}
          >
            VCFO Suite
          </span>
        </Link>
        {/* R-49: the pin button sits in the sidebar head; the rail keeps it at its foot. */}
        {expanded && onTogglePin && mode ? (
          <SidebarPinButton mode={mode} placement="head" ink={ink} onClick={onTogglePin} className="ml-auto" />
        ) : null}
      </div>

      <nav
        className={cn('sidebar-scroll flex-1 space-y-0.5 py-3', stacked ? 'px-1' : 'px-2')}
        {...navHoverProps}
      >
        <LayoutGroup id={layoutIdPrefix}>
        {items.map((it) => {
          if (isNavSectionBreak(it)) {
            return <SidebarNavSectionBreak key={it.id} expanded={expanded} ink={ink} />;
          }
          if (isNavGroup(it)) {
            return (
              <SidebarNavGroup
                key={it.id}
                id={it.id}
                label={it.label}
                icon={it.icon}
                iconTone={it.iconTone}
                items={it.items}
                expanded={expanded}
                pathname={pathname}
                layoutIdPrefix={layoutIdPrefix}
                onNavigate={onNavigate}
                ink={ink}
                hoverFollow={hoverFollow}
                stacked={stacked}
              />
            );
          }
          if (user.role === 'intern' && it.to === INTERN_CLIENTS_HREF) {
            return (
              <InternClientsNav
                key={it.to}
                expanded={expanded}
                pathname={pathname}
                layoutIdPrefix={layoutIdPrefix}
                onNavigate={onNavigate}
                icon={it.icon}
                iconTone={it.iconTone}
                ink={ink}
                hoverFollow={hoverFollow}
                stacked={stacked}
              />
            );
          }
          const active = pathname.startsWith(it.to);
          const showInternBadge = user.role === 'intern' && it.to === '/app/intern/tasks';
          return (
            <Link
              key={it.to}
              href={it.to}
              onClick={onNavigate}
              title={!expanded ? it.label : undefined}
              className={cn(
                sidebarNavTriggerClass({
                  ink,
                  active,
                  expanded,
                  fillHover: false,
                  stacked,
                }),
                user.role === 'client' && expanded && 'text-[13.5px]',
              )}
              {...sidebarHoverAttrs(it.to)}
            >
              <SidebarHoverGlass itemId={it.to} follow={hoverFollow} />
              {active && (
                <MotionActivePill
                  layoutId={`${layoutIdPrefix}-active`}
                  reduced={reduceMotion}
                  className={sidebarPillClass(ink)}
                />
              )}
              {active && expanded && (
                <MotionActivePill
                  layoutId={`${layoutIdPrefix}-rail`}
                  reduced={reduceMotion}
                  className={sidebarRailClass(ink)}
                />
              )}
              <it.icon
                className={cn(
                  'relative z-10 shrink-0',
                  stacked ? 'h-[1.15rem] w-[1.15rem]' : 'h-4 w-4',
                  active ? (ink === 'light' ? 'text-side-active-ink' : 'text-brand-text') : it.iconTone,
                )}
                strokeWidth={1.6}
              />
              {stacked ? <SidebarRailLabel>{it.label}</SidebarRailLabel> : null}
              {stacked && showInternBadge ? <StackedInternWorkBadge /> : null}
              {stacked && !showInternBadge ? <SidebarRailBadge count={it.badge ?? 0} /> : null}
              {!expanded && !stacked && showInternBadge ? <RailInternWorkBadge ink={ink} /> : null}
              {/* On the rail the name stays for screen readers; the title shows it on hover. */}
              <span className={cn('relative z-10 min-w-0 flex-1 truncate', !expanded && 'sr-only')}>
                {it.label}
              </span>
              <span
                className={cn(
                  'sidebar-nav-disclosure-meta relative z-10 ml-auto inline-flex shrink-0 items-center gap-1',
                  !expanded && 'hidden',
                )}
              >
                {showInternBadge ? <InternMyWorkBadge /> : <SidebarNavCountBadge count={it.badge ?? 0} />}
              </span>
            </Link>
          );
        })}
        <div onPointerEnter={onHoverLeave}>
          <SidebarComplianceMini expanded={expanded} staffBase={staffBase} ink={ink} />
        </div>
        </LayoutGroup>
      </nav>

      {/* R-45: Ask VCFO is a sidebar button at the bottom of the rail, with the "/" key. */}
      <div className="px-2 pb-2 pt-1 empty:hidden">
        <AskLauncher variant="sidebar" expanded={expanded} withShortcut={layoutIdPrefix === 'sidebar-desktop'} />
      </div>
      <div className={cn('p-2', ink === 'light' ? 'border-t-1.5 border-side-line' : 'border-t border-line')}>
        <div
          className={cn(
            'flex gap-1',
            expanded ? 'flex-row items-center' : 'flex-col items-center',
          )}
        >
          {!expanded && onTogglePin && mode ? (
            <SidebarPinButton mode={mode} placement="rail" ink={ink} onClick={onTogglePin} />
          ) : null}
          <Link
            href={railProfilePath(user.role)}
            onClick={onNavigate}
            /* K-16: the account row opens Profile; there is no Settings item in the sidebar. */
            title="Profile"
            aria-label="Profile"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors',
              ink === 'light' ? 'hover:bg-side-active' : 'hover:bg-surface-sunken',
              expanded ? 'min-w-0 flex-1' : 'justify-center',
            )}
          >
            <UserFace
              src={user.imageUrl}
              initials={user.initials}
              className="h-[30px] w-[30px] bg-white/[.12] text-[11px] font-medium text-side-ink ring-[1.5px] ring-white/[.22]"
            />
            {expanded && (
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'truncate text-[13.5px] font-medium',
                    ink === 'light' ? 'text-white' : 'text-ink',
                  )}
                >
                  {user.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'truncate text-[12px]',
                      ink === 'light' ? 'text-side-muted' : 'text-ink-muted',
                    )}
                  >
                    {ROLE_UI_LABEL[user.role]}
                  </span>
                </div>
              </div>
            )}
          </Link>
          {expanded ? (
            <button
              type="button"
              onClick={openShortcuts}
              aria-label="Keyboard shortcuts (?)"
              title="Keyboard shortcuts (?)"
              className={cn(
                'grid h-[30px] w-[30px] flex-none place-items-center rounded-md transition-colors',
                ink === 'light' ? 'text-side-muted hover:bg-white/[.12] hover:text-white' : 'text-ink-muted hover:bg-surface-sunken',
              )}
            >
              <Keyboard className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SidebarNavSectionBreak({
  expanded,
  ink,
}: {
  expanded: boolean;
  ink: 'light' | 'dark';
}) {
  return (
    <div
      role="separator"
      aria-hidden
      className={cn('flex items-center gap-2 px-2.5', expanded ? 'py-2.5' : 'py-1.5')}
    >
      <span
        className={cn(
          'h-px flex-1',
          ink === 'light' ? 'bg-side-line' : 'bg-line',
        )}
      />
    </div>
  );
}

/**
 * R-49 pin control. Pinned, it collapses the sidebar to the rail. On the rail (and while
 * the rail is open over the page) it pins the sidebar. The "[" key does the same.
 */
function SidebarPinButton({
  mode,
  placement,
  onClick,
  ink = 'dark',
  className,
}: {
  mode: SidebarMode;
  placement: 'head' | 'rail';
  onClick: () => void;
  ink?: 'light' | 'dark';
  className?: string;
}) {
  const pinned = sidebarIsPinned(mode);
  const { label, hint } = sidebarPinCopy(mode);
  const Icon = pinned ? PanelLeftClose : placement === 'rail' ? PanelLeftOpen : Pin;
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={label}
      aria-keyshortcuts="["
      data-sidebar-pin={pinned ? 'pinned' : 'rail'}
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        ink === 'light'
          ? 'text-side-muted hover:bg-side-hover hover:text-side-ink'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        className,
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.6} aria-hidden />
    </button>
  );
}

export function RoleSidebar() {
  const { user, sidebarMode, setSidebarMode } = useApp();
  const { sidebar, reduceMotion } = useShellAppearance();
  const pathname = usePathname();
  const narrow = useSidebarNarrow();
  const railRef = useRef<HTMLElement>(null);
  const lastExpanded = useRef<boolean | null>(null);

  /* R-49: the kept mode is saved per browser. Read it before the first paint so the
     sidebar does not slide from one width to the other on every page load. With
     nothing saved the sidebar starts pinned. */
  useLayoutEffect(() => {
    setSidebarMode(readSavedSidebarMode() ?? 'open');
  }, [setSidebarMode]);

  // Under 1100px the sidebar is always the rail, so pinning would cover the page.
  const pinned = !narrow && shellDesktopNavExpanded(sidebarMode, pathname, user?.role);
  const { peek, closeNow, handlers } = useSidebarPeek(!pinned);
  const expanded = pinned || peek;
  const expandedWidth = 'w-[15.5rem]'; // R-45: 248px for every role

  const togglePin = useCallback(() => {
    if (narrow) return;
    const next = toggleSidebarPin(sidebarMode);
    saveSidebarMode(next);
    setSidebarMode(next);
  }, [narrow, sidebarMode, setSidebarMode]);
  useSidebarPinKey(togglePin, Boolean(user) && !narrow);

  // A page opening closes the rail's peek.
  useEffect(() => {
    closeNow();
  }, [pathname, closeNow]);

  useEffect(() => {
    if (lastExpanded.current === null) {
      lastExpanded.current = expanded;
      return;
    }
    if (lastExpanded.current === expanded) return;
    lastExpanded.current = expanded;
    const el = railRef.current;
    if (el) el.style.willChange = 'width';
  }, [expanded]);

  const onWidthTransitionEnd = useCallback((event: TransitionEvent<HTMLElement>) => {
    if (event.propertyName !== 'width') return;
    event.currentTarget.style.willChange = 'auto';
  }, []);

  if (!user) return null;

  return (
    <aside
      ref={railRef}
      {...handlers}
      onTransitionEnd={onWidthTransitionEnd}
      className={cn(
        'shell-sidebar-skin fixed bottom-0 left-0 top-[3px] z-30 hidden flex-col overflow-hidden lg:flex',
        // R-49: a short slide, and none under reduced motion.
        reduceMotion ? 'transition-none' : 'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        sidebar.ink === 'light' ? 'border-r-1.5 border-side-line' : 'border-r-1.5 border-line',
        // The old "pinned closed" rail (w-16, a label under each icon) is gone: R-49 has one rail of icons.
        expanded ? expandedWidth : 'w-14',
        peek && 'z-40 shadow-float',
      )}
      data-ink={sidebar.ink}
      data-sidebar-mode={pinned ? 'pinned' : 'rail'}
      data-peek={peek ? 'true' : undefined}
      style={surfaceCssVars(sidebar, 'sidebar')}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SidebarNavBody
          expanded={expanded}
          layoutIdPrefix="sidebar-desktop"
          mode={sidebarMode}
          onTogglePin={narrow ? undefined : togglePin}
          ink={sidebar.ink}
        />
      </div>
    </aside>
  );
}

export function MobileNavSheet() {
  const { user } = useApp();
  const { mobileOpen, setMobileOpen, closeMobile } = useShellNav();
  const { sidebar } = useShellAppearance();
  if (!user) return null;

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side="left"
        className="shell-sidebar-skin flex h-full w-[min(18rem,88vw)] flex-col gap-0 border-line bg-transparent p-0 sm:max-w-xs"
        data-ink={sidebar.ink}
        style={surfaceCssVars(sidebar, 'sidebar')}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNavBody expanded onNavigate={closeMobile} layoutIdPrefix="sidebar-mobile" ink={sidebar.ink} />
      </SheetContent>
    </Sheet>
  );
}
