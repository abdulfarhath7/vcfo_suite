"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { RoleSidebar, MobileNavSheet } from "./RoleSidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { AnnouncementLivePopup } from "@/components/announcements/AnnouncementLivePopup";
import { ShellNavProvider } from "./shell-nav-context";
import { isInternEngagementPathname } from "@/lib/project-step-path";
import { shellDesktopNavExpanded } from "@/components/shell/intern-sidebar";
import { cn } from "@/lib/utils";
import { AuthBootScreen } from "@/components/common/AuthBootScreen";
import { useShellAppearance } from "@/lib/use-shell-appearance";

export function AppShell({
  requireRole,
  children,
}: {
  requireRole?: "super_admin" | "admin" | "manager" | "intern" | "client";
  children: ReactNode;
}) {
  const { user, authLoading, sidebarMode } = useApp();
  const { prefs, reduceMotion } = useShellAppearance();
  const pathname = usePathname();
  const internProjectOpen = isInternEngagementPathname(pathname);
  const navExpanded = shellDesktopNavExpanded(sidebarMode, pathname, user?.role);

  useEffect(() => {
    if (!user) {
      document.body.removeAttribute("data-role");
      return;
    }
    document.body.setAttribute("data-role", user.role);
    return () => document.body.removeAttribute("data-role");
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduce-motion", reduceMotion ? "true" : "false");
  }, [reduceMotion]);

  if (authLoading || !user) return <AuthBootScreen />;
  if (
    requireRole &&
    user.role !== requireRole &&
    user.role !== "super_admin"
  ) {
    return <AuthBootScreen label="Opening your workspace…" />;
  }

  const mainMaxWidth =
    user.role === "super_admin" || user.role === "admin" || user.role === "manager"
      ? "max-w-[1480px]"
      : user.role === "client"
        ? "max-w-[1200px]"
        : internProjectOpen
          ? "max-w-none"
          : "max-w-[1400px]";

  /* Flush to the sidebar: exact width, no screen inset */
  const desktopPad = navExpanded
    ? user.role === "client"
      ? "lg:pl-[15.5rem]"
      : "lg:pl-56"
    : "lg:pl-14";

  return (
    <ShellNavProvider>
      <div
        className="relative min-h-screen bg-[oklch(var(--background))] text-foreground"
        data-role={user.role}
        data-motion={prefs.motion}
        data-reduce-motion={reduceMotion ? "true" : "false"}
      >
        <div className="page-atmosphere pointer-events-none absolute inset-0" aria-hidden />

        <RoleSidebar />
        <MobileNavSheet />
        <CommandPalette />
        <AnnouncementLivePopup />

        <div className={cn("relative z-10 pl-0 transition-[padding] duration-300 ease-out", desktopPad)}>
          <div className="sticky top-0 z-20">
            <TopBar />
          </div>
          <main
            className={cn(
              "mx-auto page-fade-up px-5 pb-10 pt-5 sm:px-7 sm:pb-12 sm:pt-6 lg:pr-6",
              mainMaxWidth,
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </ShellNavProvider>
  );
}
