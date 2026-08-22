"use client";

import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, PanelLeft } from "lucide-react";
import { AnnouncementsBell } from "@/components/shell/AnnouncementsBell";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { SBC_LOGO_LABEL, SbcLogo } from "@/components/brand/SbcLogo";
import { roleHomePath, roleSettingsPath } from "@/lib/auth-routes";
import { UserFace } from "@/components/common/UserFace";

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
  const isApple = useModShortcut();
  const homeHref = user ? roleHomePath(user.role) : "/";
  const profileHref = user ? roleSettingsPath(user.role) : "/";

  return (
    <header className="flex h-[var(--shell-rail-height)] items-center gap-1.5 border-b border-border/50 bg-panel/80 px-2.5 backdrop-blur-2xl sm:px-3">
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
        className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <SbcLogo variant="navbar" decorative />
      </Link>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-[13px] text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-2.5"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="hidden sm:inline">Search</span>
        {isApple != null && (
          <span className="ml-0.5 hidden items-center gap-0.5 sm:flex" aria-hidden>
            {isApple ? (
              <span className="kbd">⌘</span>
            ) : (
              <span className="kbd px-1">Ctrl</span>
            )}
            <span className="kbd">K</span>
          </span>
        )}
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
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
              className="gold-sheen h-6 w-6 text-[9px] font-semibold"
            />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        )}
      </div>
    </header>
  );
}
