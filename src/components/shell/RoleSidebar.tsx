'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGroup, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  UserSquare2,
  FolderClosed,
  CalendarCheck,
  BarChart3,
  Landmark,
  Users,
  History as HistoryIcon,
  BookOpen,
  ClipboardCheck,
  ScrollText,
  FileInput,
  Mail,
  Pin,
  PanelLeftClose,
  Columns3,
  Megaphone,
  Archive,
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
import { shellDesktopNavExpanded } from '@/components/shell/intern-sidebar';
import {
  MotionActivePill,
  SidebarHoverGlass,
  sidebarHoverHandlers,
  type SidebarHoverFollow,
} from '@/components/shell/MotionActivePill';
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

const firmAdminItems: Item[] = [
  { to: '/app/admin/dashboard', label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/admin/announcements', label: 'Announcements', icon: Megaphone, iconTone: TONE.news },
  { to: '/app/admin/projects', label: 'Projects', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/mail', label: 'Send email', icon: Mail, iconTone: TONE.work },
  { to: '/app/admin/approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
  { to: '/app/admin/compliance', label: 'Compliance calendar', icon: CalendarCheck, iconTone: TONE.calendar },
  { to: '/app/admin/vault', label: 'Doc vault', icon: FolderClosed, iconTone: TONE.files },
  { to: '/app/admin/knowledge-bank', label: 'Knowledge Bank', icon: BookOpen, iconTone: TONE.knowledge },
  { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
  { to: '/app/admin/audit-log', label: 'Audit Log', icon: HistoryIcon, iconTone: TONE.audit },
];

const clientItems: Item[] = [
  { to: '/app/client/inbox', label: 'Inbox', icon: Inbox, iconTone: TONE.home },
  { to: '/app/client/announcements', label: 'Announcements', icon: Megaphone, iconTone: TONE.news },
  { to: '/app/client/incorporation', label: 'Incorporation', icon: Landmark, iconTone: TONE.work },
  { to: '/app/client/compliances', label: 'Compliances', icon: CalendarCheck, iconTone: TONE.calendar },
  { to: '/app/client/documents', label: 'Documents', icon: FolderClosed, iconTone: TONE.files },
  { to: '/app/client/team', label: 'Team', icon: Users, iconTone: TONE.people },
  { to: '/app/client/audit', label: 'Activity audit', icon: HistoryIcon, iconTone: TONE.audit },
];

const superAdminItems: Item[] = [
  { to: '/app/super/dashboard', label: 'Overview', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/super/announcements', label: 'Announcements', icon: Megaphone, iconTone: TONE.news },
  { to: '/app/admin/dashboard', label: 'Firm home', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/mail', label: 'Send email', icon: Mail, iconTone: TONE.work },
  { to: '/app/admin/audit-log', label: 'Firm audit', icon: HistoryIcon, iconTone: TONE.audit },
  { to: '/app/client/inbox', label: 'Client portal', icon: Inbox, iconTone: TONE.home },
  { to: '/app/client/audit', label: 'Client audit', icon: ScrollText, iconTone: TONE.audit },
];

export function SidebarNavBody({
  expanded,
  onNavigate,
  layoutIdPrefix = 'sidebar',
  mode,
  onSetMode,
  ink = 'dark',
}: {
  expanded: boolean;
  onNavigate?: () => void;
  layoutIdPrefix?: string;
  /** Desktop preference controls — omit on the mobile sheet. */
  mode?: SidebarMode;
  onSetMode?: (mode: SidebarMode) => void;
  ink?: 'light' | 'dark';
}) {
  const { user } = useApp();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce, motion: motionStyle } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const staticHover = reduceMotion || motionStyle === 'minimal';
  const { kpis } = useInternPortfolio();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);

  const onHoverEnter = useCallback((id: string) => {
    setHoverId(id);
    setHoverVisible(true);
  }, []);

  const onHoverLeave = useCallback(() => {
    setHoverVisible(false);
  }, []);

  if (!user) return null;

  const hoverFollow: SidebarHoverFollow = {
    hoverId,
    visible: hoverVisible,
    onEnter: onHoverEnter,
    layoutId: `${layoutIdPrefix}-hover`,
    reduced: staticHover,
    ink,
  };

  const managerItems: Item[] = [
    { to: `${staffBase}/dashboard`, label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
    { to: `${staffBase}/announcements`, label: 'Announcements', icon: Megaphone, iconTone: TONE.news },
    { to: `${staffBase}/projects`, label: 'Projects', icon: Briefcase, iconTone: TONE.work },
    { to: `${staffBase}/approvals`, label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
    { to: `${staffBase}/people`, label: 'People', icon: Users, iconTone: TONE.people },
    { to: `${staffBase}/mail`, label: 'Send email', icon: Mail, iconTone: TONE.work },
    { to: `${staffBase}/team`, label: 'Project leads', icon: UserSquare2, iconTone: TONE.people },
    { to: `${staffBase}/compliance`, label: 'Compliance calendar', icon: CalendarCheck, iconTone: TONE.calendar },
    { to: `${staffBase}/vault`, label: 'Document vault', icon: FolderClosed, iconTone: TONE.files },
    { to: `${staffBase}/knowledge-bank`, label: 'Knowledge Bank', icon: BookOpen, iconTone: TONE.knowledge },
    { to: `${staffBase}/analytics`, label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
    { to: `${staffBase}/audit-log`, label: 'Audit Log', icon: HistoryIcon, iconTone: TONE.audit },
  ];

  const internItems: Item[] = [
    { to: '/app/intern/today', label: 'Today', icon: LayoutDashboard, iconTone: TONE.home },
    {
      to: '/app/intern/tasks',
      label: 'My work',
      icon: Columns3,
      iconTone: TONE.work,
      badge: kpis.action.total,
    },
    { to: INTERN_CLIENTS_HREF, label: 'Clients', icon: UserSquare2, iconTone: TONE.people },
    { to: '/app/intern/vault', label: 'Document vault', icon: Archive, iconTone: TONE.files },
    { to: '/app/intern/announcements', label: 'Announcements', icon: Megaphone, iconTone: TONE.news },
    { to: '/app/intern/mail', label: 'Send email', icon: Mail, iconTone: TONE.work },
    { to: '/app/intern/requests', label: 'Requests', icon: FileInput, iconTone: TONE.queue },
    { to: '/app/intern/compliance', label: 'Compliance calendar', icon: CalendarCheck, iconTone: TONE.calendar },
    { to: '/app/intern/knowledge-bank', label: 'Knowledge Bank', icon: BookOpen, iconTone: TONE.knowledge },
    { to: '/app/intern/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
    { to: '/app/intern/audit-log', label: 'Audit Log', icon: HistoryIcon, iconTone: TONE.audit },
  ];

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
          expanded ? 'px-3.5' : 'justify-center px-2',
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
          {expanded && (
            <span
              className={cn(
                'truncate text-[13px] font-semibold tracking-tight',
                ink === 'light' ? 'text-white' : 'text-foreground',
              )}
            >
              VCFO Suite
            </span>
          )}
        </Link>
      </div>

      <nav
        className="sidebar-scroll flex-1 space-y-0.5 px-2 py-3"
        onMouseLeave={onHoverLeave}
        onPointerLeave={onHoverLeave}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            onHoverLeave();
          }
        }}
      >
        <LayoutGroup id={layoutIdPrefix}>
        {items.map((it) => {
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
              />
            );
          }
          const active = pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              href={it.to}
              onClick={onNavigate}
              title={!expanded ? it.label : undefined}
              className={cn(
                'nav-item relative flex min-h-[42px] items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors',
                active
                  ? 'font-medium text-role-foreground'
                  : ink === 'light'
                    ? 'text-white/90 hover:text-white'
                    : 'text-muted-foreground hover:text-foreground',
                !expanded && 'justify-center px-0',
                user.role === 'client' && expanded && 'text-[13.5px]',
              )}
              {...sidebarHoverHandlers(hoverFollow, it.to)}
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
                  'relative z-10 h-4 w-4 shrink-0',
                  active ? 'text-role-foreground' : it.iconTone,
                )}
                strokeWidth={1.75}
              />
              {expanded && (
                <>
                  <span className="relative z-10 flex-1 truncate">{it.label}</span>
                  {it.badge != null && it.badge > 0 && (
                    <span className="relative z-10 mono min-w-[1.25rem] rounded-full bg-role px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
                      {it.badge > 99 ? '99+' : it.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
        <div onMouseEnter={onHoverLeave}>
          <SidebarComplianceMini expanded={expanded} staffBase={staffBase} ink={ink} />
        </div>
        </LayoutGroup>
      </nav>

      <div className={cn('space-y-1 p-2', ink === 'light' ? 'border-t border-white/12' : 'border-t border-border/50')}>
        {onSetMode && mode ? (
          <div className="flex flex-col gap-1">
            <SidebarModeButton
              expanded={expanded}
              active={mode === 'open'}
              icon={Pin}
              fillWhenActive
              label={mode === 'open' ? 'Kept open' : 'Keep open'}
              hint={mode === 'open' ? 'Hover to collapse' : 'Keep sidebar open'}
              onClick={() => onSetMode(mode === 'open' ? 'auto' : 'open')}
              ink={ink}
            />
            <SidebarModeButton
              expanded={expanded}
              active={mode === 'closed'}
              icon={PanelLeftClose}
              label={mode === 'closed' ? 'Kept closed' : 'Keep closed'}
              hint={mode === 'closed' ? 'Click for hover open' : 'Keep sidebar closed'}
              onClick={() => onSetMode(mode === 'closed' ? 'auto' : 'closed')}
              ink={ink}
            />
          </div>
        ) : null}
        <Link
          href={roleSettingsPath(user.role)}
          onClick={onNavigate}
          title="Account settings"
          aria-label="Account settings"
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors',
            ink === 'light' ? 'hover:bg-white/12' : 'hover:bg-role-soft/50',
            !expanded && 'justify-center',
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
    </>
  );
}

const HOVER_CLOSE_MS = 200;

function SidebarModeButton({
  expanded,
  active,
  icon: Icon,
  fillWhenActive,
  label,
  hint,
  onClick,
  ink = 'dark',
}: {
  expanded: boolean;
  active: boolean;
  icon: typeof Pin;
  fillWhenActive?: boolean;
  label: string;
  hint: string;
  onClick: () => void;
  ink?: 'light' | 'dark';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      aria-label={hint}
      className={cn(
        'flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors',
        active
          ? 'bg-role-soft/70 font-medium text-role-foreground'
          : ink === 'light'
            ? 'text-white/90 hover:bg-white/12 hover:text-white'
            : 'text-muted-foreground hover:bg-role-soft/50 hover:text-foreground',
        !expanded && 'justify-center px-0',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active && fillWhenActive && 'fill-current')}
        strokeWidth={1.75}
        aria-hidden
      />
      {expanded ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

export function RoleSidebar() {
  const { user, sidebarMode, setSidebarMode } = useApp();
  const { sidebarPeeking, setSidebarPeeking } = useShellNav();
  const { sidebar } = useShellAppearance();
  const pathname = usePathname();
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expanded =
    shellDesktopNavExpanded(sidebarMode, pathname, user?.role) || sidebarPeeking;
  const expandedWidth = user?.role === 'client' ? 'w-[15.5rem]' : 'w-56';

  const clearLeaveTimer = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  useEffect(() => {
    if (sidebarMode !== 'auto') {
      clearLeaveTimer();
      setSidebarPeeking(false);
    }
  }, [sidebarMode, setSidebarPeeking]);

  useEffect(() => () => clearLeaveTimer(), []);

  if (!user) return null;

  const onMouseEnter = () => {
    clearLeaveTimer();
    if (sidebarMode === 'auto') setSidebarPeeking(true);
  };

  const onMouseLeave = () => {
    clearLeaveTimer();
    if (sidebarMode !== 'auto') return;
    leaveTimer.current = setTimeout(() => setSidebarPeeking(false), HOVER_CLOSE_MS);
  };

  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'shell-sidebar-skin fixed inset-y-0 left-0 z-30 hidden flex-col backdrop-blur-2xl transition-[width,box-shadow] duration-300 ease-out lg:flex',
        sidebar.ink === 'light' ? 'border-r border-white/12' : 'border-r border-border/50',
        expanded ? expandedWidth : 'w-14',
        sidebarMode === 'auto' && sidebarPeeking && 'z-40 shadow-[12px_0_32px_-16px_oklch(var(--shadow-ink)/0.35)]',
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
