"use client";

import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Search, PanelLeft } from "lucide-react";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { SbcLogo } from "@/components/brand/SbcLogo";
import { roleHomePath, roleSettingsPath } from "@/lib/auth-routes";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveShellBackAction, shouldShowShellBack } from "@/components/shell/shell-back";
import { shellDesktopNavExpanded } from "@/components/shell/intern-sidebar";

function useModShortcut() {
  const [isApple, setIsApple] = useState<boolean | null>(null);
  useEffect(() => {
    setIsApple(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return isApple;
}

function ShellBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!shouldShowShellBack(pathname)) return null;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            const action = resolveShellBackAction(pathname, window.history.length);
            if (action.kind === "history") {
              router.back();
              return;
            }
            router.push(action.href);
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="px-2 py-1 text-xs">
        Back
      </TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const { user, setCommandOpen, sidebarMode } = useApp();
  const { openMobile, sidebarPeeking } = useShellNav();
  const pathname = usePathname();
  const isApple = useModShortcut();
  const homeHref = user ? roleHomePath(user.role) : "/";
  const profileHref = user ? roleSettingsPath(user.role) : "/";
  /* Wordmark lives in the sidebar when pinned, on Clients list (auto), or
     hover-expanded; keep it here on mobile and when the desktop rail is icons-only. */
  const showWordmarkInBar =
    !shellDesktopNavExpanded(sidebarMode, pathname, user?.role) && !sidebarPeeking;

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
        aria-label="VCFO Suite home"
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-lg py-1 pr-1.5 text-[13px] font-semibold tracking-tight text-foreground transition-colors hover:bg-primary-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          showWordmarkInBar ? "inline-flex" : "inline-flex lg:hidden",
        )}
      >
        <SbcLogo variant="mark" size={28} decorative className="lg:hidden" />
        <span className="truncate">VCFO Suite</span>
      </Link>

      <ShellBackButton />

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
        <NotificationsBell />
        <ThemeToggle />
        {user && (
          <Link
            href={profileHref}
            aria-label="Profile"
            title="Profile"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-2"
          >
            <span
              className="gold-sheen flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
              aria-hidden
            >
              {user.initials}
            </span>
            <span className="hidden sm:inline">Profile</span>
          </Link>
        )}
      </div>
    </header>
  );
}
