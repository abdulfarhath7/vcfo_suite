'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';
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
  ListTodo,
  FileInput,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_UI_LABEL } from '@/lib/auth';
import { SbcLogo } from '@/components/brand/SbcLogo';
import { useShellNav } from '@/components/shell/shell-nav-context';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { SidebarComplianceMini } from '@/components/shell/SidebarComplianceMini';
import { InternClientsNav, INTERN_CLIENTS_HREF } from '@/components/shell/InternClientsNav';
import { roleHomePath } from '@/lib/auth-routes';

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
  analytics: 'text-info',
  audit: 'text-text-tertiary',
};

const firmAdminItems: Item[] = [
  { to: '/app/admin/dashboard', label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/admin/projects', label: 'Projects', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
  { to: '/app/admin/compliance', label: 'Compliance calendar', icon: CalendarCheck, iconTone: TONE.calendar },
  { to: '/app/admin/vault', label: 'Doc vault', icon: FolderClosed, iconTone: TONE.files },
  { to: '/app/admin/knowledge-bank', label: 'Knowledge Bank', icon: BookOpen, iconTone: TONE.knowledge },
  { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
  { to: '/app/admin/audit-log', label: 'Audit Log', icon: HistoryIcon, iconTone: TONE.audit },
];

const clientItems: Item[] = [
  { to: '/app/client/inbox', label: 'Inbox', icon: Inbox, iconTone: TONE.home },
  { to: '/app/client/incorporation', label: 'Incorporation', icon: Landmark, iconTone: TONE.work },
  { to: '/app/client/compliances', label: 'Compliances', icon: CalendarCheck, iconTone: TONE.calendar },
  { to: '/app/client/documents', label: 'Documents', icon: FolderClosed, iconTone: TONE.files },
  { to: '/app/client/team', label: 'Team', icon: Users, iconTone: TONE.people },
  { to: '/app/client/audit', label: 'Activity audit', icon: HistoryIcon, iconTone: TONE.audit },
];

const superAdminItems: Item[] = [
  { to: '/app/super/dashboard', label: 'Overview', icon: LayoutDashboard, iconTone: TONE.home },
  { to: '/app/admin/dashboard', label: 'Firm home', icon: Briefcase, iconTone: TONE.work },
  { to: '/app/admin/people', label: 'People', icon: Users, iconTone: TONE.people },
  { to: '/app/admin/audit-log', label: 'Firm audit', icon: HistoryIcon, iconTone: TONE.audit },
  { to: '/app/client/inbox', label: 'Client portal', icon: Inbox, iconTone: TONE.home },
  { to: '/app/client/audit', label: 'Client audit', icon: ScrollText, iconTone: TONE.audit },
];

export function SidebarNavBody({
  expanded,
  onNavigate,
  layoutIdPrefix = 'sidebar',
}: {
  expanded: boolean;
  onNavigate?: () => void;
  layoutIdPrefix?: string;
}) {
  const { user } = useApp();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();

  if (!user) return null;

  const managerItems: Item[] = [
    { to: `${staffBase}/dashboard`, label: 'Home', icon: LayoutDashboard, iconTone: TONE.home },
    { to: `${staffBase}/projects`, label: 'Projects', icon: Briefcase, iconTone: TONE.work },
    { to: `${staffBase}/approvals`, label: 'Approvals', icon: ClipboardCheck, iconTone: TONE.queue },
    { to: `${staffBase}/people`, label: 'People', icon: Users, iconTone: TONE.people },
    { to: `${staffBase}/team`, label: 'Project leads', icon: UserSquare2, iconTone: TONE.people },
    { to: `${staffBase}/compliance`, label: 'Compliance calendar', icon: CalendarCheck, iconTone: TONE.calendar },
    { to: `${staffBase}/vault`, label: 'Document vault', icon: FolderClosed, iconTone: TONE.files },
    { to: `${staffBase}/knowledge-bank`, label: 'Knowledge Bank', icon: BookOpen, iconTone: TONE.knowledge },
    { to: `${staffBase}/analytics`, label: 'Analytics', icon: BarChart3, iconTone: TONE.analytics },
    { to: `${staffBase}/audit-log`, label: 'Audit Log', icon: HistoryIcon, iconTone: TONE.audit },
  ];

  const internItems: Item[] = [
    { to: '/app/intern/today', label: 'Today', icon: LayoutDashboard, iconTone: TONE.home },
    { to: INTERN_CLIENTS_HREF, label: 'Clients', icon: UserSquare2, iconTone: TONE.people },
    { to: '/app/intern/tasks', label: 'Tasks', icon: ListTodo, iconTone: TONE.work },
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
          'flex h-[var(--shell-rail-height)] shrink-0 items-center border-b border-border/50',
          expanded ? 'px-3.5' : 'justify-center px-2',
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
            <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              VCFO Suite
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
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
                  : 'text-muted-foreground hover:bg-role-soft/50 hover:text-foreground',
                !expanded && 'justify-center px-0',
                user.role === 'client' && expanded && 'text-[13.5px]',
              )}
            >
              {active && (
                <m.div
                  layoutId={`${layoutIdPrefix}-active`}
                  className="absolute inset-0 rounded-xl border border-role/25 bg-role-soft shadow-[inset_0_1px_0_oklch(100%_0_0/0.35)] dark:shadow-[inset_0_1px_0_oklch(100%_0_0/0.07)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
                />
              )}
              {active && expanded && (
                <m.div
                  layoutId={`${layoutIdPrefix}-rail`}
                  className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-role"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
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
        <SidebarComplianceMini expanded={expanded} staffBase={staffBase} />
      </nav>

      <div className="space-y-2 border-t border-border/50 p-2">
        <Link
          href={
            user.role === 'super_admin'
              ? '/app/super/settings'
              : user.role === 'admin'
              ? '/app/admin/settings'
              : user.role === 'manager'
                ? '/app/manager/settings'
                : user.role === 'intern'
                  ? '/app/intern/settings'
                  : '/app/client/settings'
          }
          onClick={onNavigate}
          title="Account settings"
          aria-label="Account settings"
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-role-soft/50',
            !expanded && 'justify-center',
          )}
        >
          <div className="gold-sheen flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
            {user.initials}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">{user.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="mono truncate text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
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

export function RoleSidebar() {
  const { user, sidebarCollapsed, toggleSidebar } = useApp();
  if (!user) return null;

  return (
    <aside
      className={cn(
        'group/sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/50 bg-panel/80 backdrop-blur-2xl transition-[width] duration-300 ease-out lg:flex',
        sidebarCollapsed ? 'w-14' : user.role === 'client' ? 'w-[15.5rem]' : 'w-56',
      )}
    >
      {/* Inner wrapper clips nav content during the width transition; the
          aside itself stays overflow-visible so the edge toggle can straddle
          the border. */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SidebarNavBody expanded={!sidebarCollapsed} layoutIdPrefix="sidebar-desktop" />
      </div>

      {/* Floating collapse toggle — vertically centered on the sidebar edge */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'sidebar-edge-toggle absolute -right-[11px] top-1/2 z-40 flex h-11 w-[22px] -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground',
          // Reveal on sidebar hover (Notion-style); stay visible when
          // collapsed so the way back is always obvious.
          sidebarCollapsed
            ? 'opacity-100'
            : 'opacity-0 focus-visible:opacity-100 group-hover/sidebar:opacity-100',
        )}
      >
        <ChevronLeft
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-300 ease-out',
            sidebarCollapsed && 'rotate-180',
          )}
          strokeWidth={2.25}
        />
      </button>
    </aside>
  );
}

export function MobileNavSheet() {
  const { user } = useApp();
  const { mobileOpen, setMobileOpen, closeMobile } = useShellNav();
  if (!user) return null;

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side="left"
        className="flex h-full w-[min(18rem,88vw)] flex-col gap-0 border-border/60 bg-background/95 p-0 backdrop-blur-xl sm:max-w-xs"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNavBody expanded onNavigate={closeMobile} layoutIdPrefix="sidebar-mobile" />
      </SheetContent>
    </Sheet>
  );
}
