"use client";

import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search, PanelLeft } from "lucide-react";
import { AnnouncementsBell } from "@/components/shell/AnnouncementsBell";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { SBC_LOGO_LABEL, SbcLogo } from "@/components/brand/SbcLogo";
import { roleHomePath, roleSettingsPath } from "@/lib/auth-routes";
import { UserFace } from "@/components/common/UserFace";
import { shellBreadcrumb } from "@/components/shell/shell-crumbs";
import { cn } from "@/lib/utils";

function useModShortcut() {
  const [isApple, setIsApple] = useState<boolean | null>(null);
  useEffect(() => {
    setIsApple(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return isApple;
}

export function TopBar() {
  const { user, setCommandOpen } = useApp();
  const { openMobile } = useShellNav();
  const pathname = usePathname();
  const crumb = shellBreadcrumb(pathname);
  const isApple = useModShortcut();
  const homeHref = user ? roleHomePath(user.role) : "/";
  const profileHref = user ? roleSettingsPath(user.role) : "/";

  return (
    <header className="flex h-[var(--shell-rail-height)] items-center gap-2 border-b border-border/60 bg-panel/90 px-2.5 backdrop-blur-2xl sm:gap-3 sm:px-4">
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

      <nav
        aria-label="Breadcrumb"
        className="hidden min-w-0 items-center gap-1 text-[13px] md:flex"
      >
        {crumb.parent ? (
          <>
            <span className="truncate text-muted-foreground">{crumb.parent}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={2} aria-hidden />
          </>
        ) : null}
        <span className="truncate font-medium text-ink">{crumb.current}</span>
      </nav>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search"
        className={cn(
          "mx-auto hidden h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-xl border border-border/70 bg-raised/50 px-3 text-[13px] text-muted-foreground transition-colors",
          "hover:border-primary/30 hover:bg-raised hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          "sm:flex",
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 truncate text-left">Search</span>
        {isApple != null && (
          <span className="hidden items-center gap-0.5 lg:flex" aria-hidden>
            {isApple ? <span className="kbd">⌘</span> : <span className="kbd px-1">Ctrl</span>}
            <span className="kbd">K</span>
          </span>
        )}
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary-light hover:text-foreground sm:hidden"
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
