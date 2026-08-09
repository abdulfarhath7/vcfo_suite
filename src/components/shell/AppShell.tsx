"use client";

import { type ReactNode, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { RoleSidebar, MobileNavSheet } from "./RoleSidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { ShellNavProvider } from "./shell-nav-context";
import { cn } from "@/lib/utils";
import { AuthBootScreen } from "@/components/common/AuthBootScreen";

export function AppShell({
  requireRole,
  children,
}: {
  requireRole?: "super_admin" | "admin" | "manager" | "intern" | "client";
  children: ReactNode;
}) {
  const { user, authLoading, sidebarCollapsed } = useApp();

  useEffect(() => {
    if (!user) {
      document.body.removeAttribute("data-role");
      return;
    }
    document.body.setAttribute("data-role", user.role);
    return () => document.body.removeAttribute("data-role");
  }, [user]);

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
        : "max-w-[1400px]";

  /* Floating sidebar inset: left-3 (12px) + width + gap */
  const desktopPad = sidebarCollapsed
    ? "lg:pl-[4.75rem]"
    : user.role === "client"
      ? "lg:pl-[17rem]"
      : "lg:pl-[16rem]";

  return (
    <ShellNavProvider>
      <div
        className="relative min-h-screen bg-[oklch(var(--background))] text-foreground"
        data-role={user.role}
      >
        {/* Soft ledger atmosphere */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 85% 50% at 100% 0%, oklch(var(--orange-100) / 0.45), transparent 55%),
              radial-gradient(ellipse 55% 40% at 0% 100%, oklch(var(--orange-50) / 0.55), transparent 50%),
              oklch(var(--background))
            `,
          }}
          aria-hidden
        />

        <RoleSidebar />
        <MobileNavSheet />
        <CommandPalette />

        <div className={cn("relative z-10 pl-0 transition-[padding] duration-300 ease-out", desktopPad)}>
          <div className="sticky top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-3.5 lg:pr-4">
            <TopBar />
          </div>
          <main className={cn("mx-auto px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-5 lg:pr-4", mainMaxWidth)}>
            {children}
          </main>
        </div>
      </div>
    </ShellNavProvider>
  );
}
