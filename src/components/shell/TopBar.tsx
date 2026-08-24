"use client";

import { useApp } from "@/context/AppContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  History,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  PanelLeft,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { AnnouncementsBell } from "@/components/shell/AnnouncementsBell";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { SBC_LOGO_LABEL, SbcLogo } from "@/components/brand/SbcLogo";
import { roleHomePath, roleSettingsPath } from "@/lib/auth-routes";
import { UserFace } from "@/components/common/UserFace";
import { CommandPalette } from "@/components/shell/CommandPalette";
import {
  resolveShellCrumbSegments,
  shellBreadcrumb,
  type ShellCrumbSegment,
  type ShellCrumbIcon,
} from "@/components/shell/shell-crumbs";
import { cn } from "@/lib/utils";

const CRUMB_ICONS: Record<ShellCrumbIcon, LucideIcon> = {
  users: Users,
  folder: FolderOpen,
  megaphone: Megaphone,
  bell: Bell,
  layout: LayoutDashboard,
  briefcase: Briefcase,
  inbox: Inbox,
  mail: Mail,
  calendar: CalendarCheck,
  book: BookOpen,
  chart: BarChart3,
  clipboard: ClipboardCheck,
  history: History,
  settings: Settings,
  home: LayoutDashboard,
};

function ShellLocationTrail({
  icon,
  segments,
}: {
  icon: ShellCrumbIcon;
  segments: ShellCrumbSegment[];
}) {
  const Icon = CRUMB_ICONS[icon];

  return (
    <nav aria-label="Location" className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary-light text-primary"
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <ol className="flex min-w-0 list-none items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {segments.map((seg, index) => (
          <li key={`${seg.label}-${index}`} className="flex shrink-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-muted-foreground/45"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            {seg.href ? (
              <Link
                href={seg.href}
                className="whitespace-nowrap text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {seg.label}
              </Link>
            ) : (
              <span
                className="whitespace-nowrap text-[13px] font-medium text-ink"
                title={seg.label}
                aria-current="page"
              >
                {seg.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function TopBar() {
  const { user, setCommandOpen, commandOpen, engagements } = useApp();
  const { openMobile } = useShellNav();
  const pathname = usePathname();
  const crumb = shellBreadcrumb(pathname);
  const segments = resolveShellCrumbSegments(crumb, engagements);
  const homeHref = user ? roleHomePath(user.role) : "/";
  const profileHref = user ? roleSettingsPath(user.role) : "/";

  return (
    <header className="relative flex h-[var(--shell-rail-height)] items-center gap-2 border-b border-border/60 bg-panel/90 px-2.5 backdrop-blur-2xl sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={openMobile}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <Link
        href={homeHref}
        aria-label={`${SBC_LOGO_LABEL} home`}
        className="inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <SbcLogo variant="navbar" decorative />
      </Link>

      <ShellLocationTrail icon={crumb.icon} segments={segments} />

      <CommandPalette />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary-light hover:text-foreground sm:hidden",
            commandOpen && "pointer-events-none opacity-0",
          )}
          aria-label="Search"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <AnnouncementsBell />
        <NotificationsBell />
        <ThemeToggle />
        {user && (
          <Link
            href={profileHref}
            aria-label="Profile"
            title="Profile"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-2"
          >
            <UserFace
              src={user.imageUrl}
              initials={user.initials}
              className="h-6 w-6 bg-primary text-[9px] font-semibold text-primary-foreground"
            />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        )}
      </div>
    </header>
  );
}
