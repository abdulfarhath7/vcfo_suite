'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type TransitionEvent } from 'react';
import { LayoutGroup, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  UserSquare2,
  FolderClosed,
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
  PanelLeft,
  PanelLeftClose,
  Columns3,
  Megaphone,
  Archive,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_UI_LABEL } from '@/lib/auth';
import { UserFace } from '@/components/common/UserFace';
import type { SidebarMode } from '@/context/AppContext';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { useShellNav } from '@/components/shell/shell-nav-context';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { SidebarComplianceMini } from '@/components/shell/SidebarComplianceMini';
import { InternClientsNav, INTERN_CLIENTS_HREF } from '@/components/shell/InternClientsNav';
import {
  SidebarNavCountBadge,
  SidebarNavGroup,
  SidebarRailBadge,
  SidebarRailLabel,
  sidebarNavTriggerClass,
  type SidebarNavLeaf,
} from '@/components/shell/SidebarNavGroup';
import { cycleSidebarMode, shellDesktopNavExpanded, sidebarPinCopy } from '@/components/shell/intern-sidebar';
import { MotionActivePill, SidebarHoverGlass, sidebarHoverAttrs, useSidebarHoverFollow } from '@/components/shell/MotionActivePill';
import { roleHomePath, roleSettingsPath } from '@/lib/auth-routes';
import { useInternPortfolio } from '@/lib/use-intern-portfolio';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { surfaceCssVars } from '@/lib/shell-appearance';

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

/* Functional icon color map: overview = role accent, work = blue,
   approvals/queues = muted gold, people = sky, calendar = teal-green,
   files = teal, knowledge = sky, analytics = sky, audit = neutral. */
const TONE = {
  home: 'text-role',
  work: 'text-primary',
  queue: 'text-warning',
  people: 'text-info',
  calendar: 'text-success',
  files: 'text-phase-filing-text',
  knowledge: 'text-info',
  news: 'text-accent-violet',
  analytics: 'text-info',
  audit: 'text-text-tertiary',
};

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

const firmAdminItems: NavEntry[] = [
  { to: '/app/admin/dashboard', label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
  updatesGroup('/app/admin'),
  { to: '/app/admin/projects', label: 'Projects', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
  { to: '/app/admin/compliance', label: 'Compliance', icon: CalendarCheck, iconTone: TONE.calendar },
  { to: '/app/admin/mail', label: 'Email', icon: Mail, iconTone: TONE.work },
  docsGroup('/app/admin'),
  NAV_TOOLS_BREAK,
  { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
  { to: '/app/admin/audit-log', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
];

const clientItems: NavEntry[] = [
  { to: '/app/client/inbox', label: 'Inbox', icon: Inbox, iconTone: TONE.home },
  updatesGroup('/app/client'),
  { to: '/app/client/incorporation', label: 'Incorporation', icon: Landmark, iconTone: TONE.work },
  { to: '/app/client/compliances', label: 'Compliances', icon: CalendarCheck, iconTone: TONE.calendar },
  { to: '/app/client/documents', label: 'Documents', icon: FolderClosed, iconTone: TONE.files },
  { to: '/app/client/team', label: 'Team', icon: Users, iconTone: TONE.people },
  { to: '/app/client/audit', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
];

const superAdminItems: NavEntry[] = [
  { to: '/app/super/dashboard', label: 'Overview', icon: LayoutDashboard, iconTone: TONE.home },
  updatesGroup('/app/super'),
  { to: '/app/admin/dashboard', label: 'Firm', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/mail', label: 'Email', icon: Mail, iconTone: TONE.work },
  { to: '/app/admin/audit-log', label: 'Firm log', icon: HistoryIcon, iconTone: TONE.audit },
  { to: '/app/client/inbox', label: 'Portal', icon: Inbox, iconTone: TONE.home },
  { to: '/app/client/audit', label: 'Client log', icon: ScrollText, iconTone: TONE.audit },
];

const InternMyWorkBadge = memo(function InternMyWorkBadge() {
  const { kpis } = useInternPortfolio();
  return <SidebarNavCountBadge count={kpis.action.total} />;
});

const StackedInternWorkBadge = memo(function StackedInternWorkBadge() {
  const { kpis } = useInternPortfolio();
  return <SidebarRailBadge count={kpis.action.total} />;
});

export function SidebarNavBody({
  expanded,
  onNavigate,
  layoutIdPrefix = 'sidebar',
  mode,
  onSetMode,
  ink = 'dark',
  stacked = false,
}: {
  expanded: boolean;
  onNavigate?: () => void;
  layoutIdPrefix?: string;
  /** Desktop preference controls — omit on the mobile sheet. */
  mode?: SidebarMode;
  onSetMode?: (mode: SidebarMode) => void;
  ink?: 'light' | 'dark';
  /** Pinned closed: icon over a short label. Hover-peek stays icon-only. */
  stacked?: boolean;
}) {
  const { user } = useApp();
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
      updatesGroup(staffBase),
      { to: `${staffBase}/projects`, label: 'Projects', icon: Briefcase, iconTone: TONE.work },
      { to: `${staffBase}/approvals`, label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
      { to: `${staffBase}/people`, label: 'People', icon: Users, iconTone: TONE.people },
      { to: `${staffBase}/team`, label: 'Leads', icon: UserSquare2, iconTone: TONE.people },
      { to: `${staffBase}/compliance`, label: 'Compliance', icon: CalendarCheck, iconTone: TONE.calendar },
      { to: `${staffBase}/mail`, label: 'Email', icon: Mail, iconTone: TONE.work },
      docsGroup(staffBase),
      NAV_TOOLS_BREAK,
      { to: `${staffBase}/analytics`, label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
      { to: `${staffBase}/audit-log`, label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
    ],
    [staffBase],
  );

  const internItems = useMemo<NavEntry[]>(
    () => [
      { to: '/app/intern/today', label: 'Today', icon: LayoutDashboard, iconTone: TONE.home },
      { to: '/app/intern/tasks', label: 'Work', icon: Columns3, iconTone: TONE.work },
      { to: INTERN_CLIENTS_HREF, label: 'Clients', icon: UserSquare2, iconTone: TONE.people },
      { to: '/app/intern/mail', label: 'Email', icon: Mail, iconTone: TONE.work },
      docsGroup('/app/intern', Archive),
      updatesGroup('/app/intern'),
      { to: '/app/intern/compliance', label: 'Compliance', icon: CalendarCheck, iconTone: TONE.calendar },
      NAV_TOOLS_BREAK,
      { to: '/app/intern/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
      { to: '/app/intern/audit-log', label: 'Audit', icon: HistoryIcon, iconTone: TONE.audit },
    ],
    [],
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
            : clientItems;

  return (
    <>
      <div
        className={cn(
          'flex h-[var(--shell-rail-height)] shrink-0 items-center',
          expanded ? 'px-3.5' : 'justify-center px-1',
          ink === 'light' ? 'border-b border-white/12' : 'border-b border-border/50',
        )}
      >
        <Link
          href={roleHomePath(user.role)}
          onClick={onNavigate}
          aria-label="VCFO Suite home"
          className={cn(
            'flex min-w-0 items-center rounded-lg py-1 transition-colors hover:bg-primary-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            expanded ? 'gap-2.5 pr-1.5' : 'justify-center',
          )}
        >
          <SbcLogo variant="mark" size={28} decorative />
          <span
            className={cn(
              'truncate text-[13px] font-semibold tracking-tight',
              ink === 'light' ? 'text-white' : 'text-foreground',
              !expanded && 'hidden',
            )}
          >
            VCFO Suite
          </span>
        </Link>
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
                  className="absolute inset-0 rounded-xl border border-role/25 bg-role-soft shadow-[inset_0_1px_0_oklch(100%_0_0/0.35)] dark:shadow-[inset_0_1px_0_oklch(100%_0_0/0.07)]"
                />
              )}
              {active && expanded && (
                <MotionActivePill
                  layoutId={`${layoutIdPrefix}-rail`}
                  reduced={reduceMotion}
                  className="absolute bottom-2 left-0 top-2 z-[2] w-[3px] rounded-full bg-role"
                />
              )}
              <it.icon
                className={cn(
                  'relative z-10 shrink-0',
                  stacked ? 'h-[1.15rem] w-[1.15rem]' : 'h-4 w-4',
                  active ? 'text-role-foreground' : it.iconTone,
                )}
                strokeWidth={1.75}
              />
              {stacked ? <SidebarRailLabel>{it.label}</SidebarRailLabel> : null}
              {stacked && showInternBadge ? <StackedInternWorkBadge /> : null}
              {stacked && !showInternBadge ? <SidebarRailBadge count={it.badge ?? 0} /> : null}
              <span className={cn('relative z-10 min-w-0 flex-1 truncate', !expanded && 'hidden')}>
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

      <div className={cn('p-2', ink === 'light' ? 'border-t border-white/12' : 'border-t border-border/50')}>
        <div
          className={cn(
            'flex gap-1',
            expanded ? 'flex-row items-center' : 'flex-col items-center',
          )}
        >
          {onSetMode && mode ? (
            <SidebarPinButton
              mode={mode}
              expanded={expanded}
              ink={ink}
              onClick={() => onSetMode(cycleSidebarMode(mode))}
              className={expanded ? 'order-last' : undefined}
            />
          ) : null}
          <Link
            href={roleSettingsPath(user.role)}
            onClick={onNavigate}
            title="Account settings"
            aria-label="Account settings"
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors',
              ink === 'light' ? 'hover:bg-white/12' : 'hover:bg-role-soft/50',
              expanded ? 'min-w-0 flex-1' : 'justify-center',
            )}
          >
            <UserFace
              src={user.imageUrl}
              initials={user.initials}
              className="gold-sheen h-8 w-8 text-[11px] font-semibold"
            />
            {expanded && (
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'truncate text-xs font-medium',
                    ink === 'light' ? 'text-white' : 'text-foreground',
                  )}
                >
                  {user.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'mono truncate text-[9.5px] uppercase tracking-[0.16em]',
                      ink === 'light' ? 'text-white/85' : 'text-muted-foreground',
                    )}
                  >
                    {ROLE_UI_LABEL[user.role]}
                  </span>
                  {user.role === 'super_admin' && (
                    <span className="super-gold-chip shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em]">
                      Gold
                    </span>
                  )}
                </div>
              </div>
            )}
          </Link>
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
          'h-px flex-1 rounded-full',
          ink === 'light' ? 'bg-white/28' : 'bg-primary/22',
        )}
      />
      {expanded ? (
        <span
          className={cn(
            'shrink-0 font-mono text-[8.5px] uppercase tracking-[0.14em]',
            ink === 'light' ? 'text-white/50' : 'text-primary/55',
          )}
        >
          Insights
        </span>
      ) : null}
      <span
        className={cn(
          'h-px flex-1 rounded-full',
          ink === 'light' ? 'bg-white/28' : 'bg-primary/22',
        )}
      />
    </div>
  );
}

const HOVER_CLOSE_MS = 200;

const SIDEBAR_PIN_ICON = {
  auto: PanelLeft,
  open: Pin,
  closed: PanelLeftClose,
} as const;

function SidebarPinButton({
  mode,
  expanded,
  onClick,
  ink = 'dark',
  className,
}: {
  mode: SidebarMode;
  expanded: boolean;
  onClick: () => void;
  ink?: 'light' | 'dark';
  className?: string;
}) {
  const { label, hint } = sidebarPinCopy(mode);
  const Icon = SIDEBAR_PIN_ICON[mode];
  const pinned = mode !== 'auto';
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={hint}
      data-sidebar-pin={mode}
      className={cn(
        'flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-[color,background-color,opacity] duration-200',
        expanded ? 'px-2' : 'w-8 px-0',
        pinned
          ? 'bg-role-soft/70 text-role-foreground'
          : ink === 'light'
            ? 'text-white/90 hover:bg-white/12 hover:text-white'
            : 'text-muted-foreground hover:bg-role-soft/50 hover:text-foreground',
        className,
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', mode === 'open' && 'fill-current')}
        strokeWidth={1.75}
        aria-hidden
      />
      {expanded ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

export function RoleSidebar() {
  const { user, sidebarMode, setSidebarMode } = useApp();
  const { sidebar } = useShellAppearance();
  const pathname = usePathname();
  const [peeking, setPeeking] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railRef = useRef<HTMLElement>(null);
  const lastExpanded = useRef<boolean | null>(null);

  const pinned = shellDesktopNavExpanded(sidebarMode, pathname, user?.role);
  const expanded = pinned || peeking;
  const expandedWidth = user?.role === 'client' ? 'w-[15.5rem]' : 'w-56';
  // Pinned closed is a destination, so it gets labels. Hover-peek collapse is
  // transient — labels there would make the rail jitter on every pointer exit.
  const stackedRail = !expanded && sidebarMode === 'closed';

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (sidebarMode !== 'auto') {
      clearLeaveTimer();
      setPeeking(false);
    }
  }, [sidebarMode, clearLeaveTimer]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (!mq.matches) {
        clearLeaveTimer();
        setPeeking(false);
      }
    };
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [clearLeaveTimer]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

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

  const onPointerEnter = useCallback(() => {
    clearLeaveTimer();
    if (sidebarMode === 'auto') setPeeking(true);
  }, [clearLeaveTimer, sidebarMode]);

  const onPointerLeave = useCallback(() => {
    clearLeaveTimer();
    if (sidebarMode !== 'auto') return;
    leaveTimer.current = setTimeout(() => setPeeking(false), HOVER_CLOSE_MS);
  }, [clearLeaveTimer, sidebarMode]);

  const onWidthTransitionEnd = useCallback((event: TransitionEvent<HTMLElement>) => {
    if (event.propertyName !== 'width') return;
    event.currentTarget.style.willChange = 'auto';
  }, []);

  if (!user) return null;

  return (
    <aside
      ref={railRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onTransitionEnd={onWidthTransitionEnd}
      className={cn(
        'shell-sidebar-skin fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden transition-[width] duration-300 ease-out lg:flex',
        sidebar.ink === 'light' ? 'border-r border-white/12' : 'border-r border-border/50',
        expanded ? expandedWidth : stackedRail ? 'w-16' : 'w-14',
        sidebarMode === 'auto' && peeking && 'z-40 shadow-[12px_0_32px_-16px_oklch(var(--shadow-ink)/0.35)]',
      )}
      data-ink={sidebar.ink}
      style={surfaceCssVars(sidebar, 'sidebar')}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SidebarNavBody
          expanded={expanded}
          layoutIdPrefix="sidebar-desktop"
          mode={sidebarMode}
          onSetMode={setSidebarMode}
          ink={sidebar.ink}
          stacked={stackedRail}
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
        className="shell-sidebar-skin flex h-full w-[min(18rem,88vw)] flex-col gap-0 border-border/60 bg-transparent p-0 sm:max-w-xs"
        data-ink={sidebar.ink}
        style={surfaceCssVars(sidebar, 'sidebar')}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNavBody expanded onNavigate={closeMobile} layoutIdPrefix="sidebar-mobile" ink={sidebar.ink} />
      </SheetContent>
    </Sheet>
  );
}
