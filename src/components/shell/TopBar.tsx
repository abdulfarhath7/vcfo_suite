"use client";

import { useApp } from "@/context/AppContext";
import { AskLauncher } from "@/components/ask/AskLauncher";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { AnnouncementsBell } from "@/components/shell/AnnouncementsBell";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { SBC_LOGO_LABEL, SbcLogo } from "@/components/brand/SbcLogo";
import { roleHomePath, roleSettingsPath } from "@/lib/auth-routes";
import { UserFace } from "@/components/common/UserFace";
import { CommandPalette } from "@/components/shell/CommandPalette";

export function TopBar() {
  const { user } = useApp();
  const { openMobile } = useShellNav();
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

      <CommandPalette />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <AskLauncher />
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
