"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveShellBackAction, shouldShowShellBack } from "@/components/shell/shell-back";
import { cn } from "@/lib/utils";

/** Compact back chevron for nested AppShell page titles. Hidden on sidebar homes. */
export function PageBackButton({
  className,
  force,
  fallbackHref,
  label,
}: {
  className?: string;
  /** Show even on a sidebar-home pathname (in-page drill-down). */
  force?: boolean;
  /** Parent href when history cannot go back. Overrides `shellBackFallbackPath`. */
  fallbackHref?: string;
  /** Names the place this returns to, so the control is not only a chevron. */
  label?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (!force && !shouldShowShellBack(pathname)) return null;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label ?? "Back"}
          onClick={() => {
            const action = resolveShellBackAction(pathname, window.history.length);
            if (action.kind === "history") {
              router.back();
              return;
            }
            router.push(fallbackHref ?? action.href);
          }}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl text-[13px] font-medium text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            label ? "px-2" : "w-9",
            className,
          )}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="px-2 py-1 text-xs">
        {label ?? "Back"}
      </TooltipContent>
    </Tooltip>
  );
}

/** Back chevron clustered with the first useful in-page title (not the crumb leaf). */
export function PageBackCluster({
  children,
  forceBack,
  backFallbackHref,
  className,
}: {
  children?: ReactNode;
  forceBack?: boolean;
  backFallbackHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <PageBackButton className="-ml-1.5" force={forceBack} fallbackHref={backFallbackHref} />
      {children}
    </div>
  );
}
