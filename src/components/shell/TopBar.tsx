"use client";

import { useApp } from "@/context/AppContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer } from "react";
import { Search, PanelLeft, LogOut } from "lucide-react";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useShellNav } from "@/components/shell/shell-nav-context";
import { AccentButton } from "@/components/noir";
import { engagementDbId, fetchEngagementById, fetchEngagementBySlug } from "@/lib/engagements-db";
import { isEngagementRouteParam, isUuid } from "@/lib/slug";
import { ROLE_UI_LABEL } from "@/lib/auth";
import toast from "react-hot-toast";

const ENGAGEMENT_DETAIL_PATHS = [
  { role: "admin", section: "projects" },
  { role: "admin", section: "engagements" },
  { role: "intern", section: "engagements" },
] as const;

function parseEngagementIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "app" || parts.length < 4) return null;
  const [, role, section, id] = parts;
  if (!id) return null;
  const isProjectDetail = ENGAGEMENT_DETAIL_PATHS.some(
    (p) => p.role === role && p.section === section,
  );
  if (!isProjectDetail || !isEngagementRouteParam(id)) return null;
  return id;
}

function findEngagementCompanyName(
  engagements: { id: string; slug?: string; companyName: string }[],
  engagementId: string,
): string | null {
  const dbId = engagementDbId(engagementId);
  const match = engagements.find(
    (e) =>
      e.id === engagementId ||
      e.slug === engagementId ||
      engagementDbId(e.id) === dbId,
  );
  return match?.companyName ?? null;
}

function formatSegmentLabel(segment: string): string {
  return segment.replace(/-/g, " ");
}

/** Primary page title in the chrome bar (prefer this over repeating an on-page H1). */
function pageTitleFromPath(pathname: string, role: string | undefined): string {
  const parts = pathname.split("/").filter(Boolean);
  const segment = parts[parts.length - 1] ?? "";
  const parent = parts[parts.length - 2] ?? "";

  if (parent === "projects" && segment === "new") return "New project";
  if (parent === "projects" && isEngagementRouteParam(segment)) {
    return role === "admin" || role === "manager" || role === "super_admin" ? "Project" : "Engagement";
  }
  if (segment === "dashboard") return "Dashboard";
  if (segment === "today") return "Today";
  if (segment === "inbox") return "Inbox";
  if (segment === "incorporation") return "Incorporation";
  if (segment === "projects") return "Projects";
  if (segment === "people") return "People";
  if (segment === "settings") return "Account settings";
  if (segment === "tasks") return "Tasks";
  if (segment === "requests") return "Requests";
  if (segment === "clients") return "Clients";
  if (segment === "compliance") return "Compliance";
  if (segment === "vault") return "Document vault";
  if (segment === "analytics") return "Analytics";
  if (segment === "documents") return "Documents";
  if (segment === "messages") return "Messages";
  if (segment === "board-resolution") return "Board resolution";
  if (isEngagementRouteParam(segment)) return role === "admin" ? "Project" : "Engagement";
  return formatSegmentLabel(segment);
}

function breadcrumbLabel(segment: string, engagementId: string | null, projectLabel: string): string {
  if (engagementId && segment === engagementId) return projectLabel;
  if (segment === "new") return "New";
  if (segment === "projects") return "Projects";
  if (segment === "people") return "People";
  if (segment === "settings") return "Settings";
  if (segment === "dashboard") return "Dashboard";
  if (segment === "compliance") return "Compliance";
  if (segment === "admin" || segment === "manager" || segment === "intern" || segment === "client" || segment === "super") {
    return segment;
  }
  return formatSegmentLabel(segment);
}

function TruncatedLabel({ label, title }: { label: string; title?: string }) {
  const fullTitle = title ?? label;
  return (
    <span className="max-w-[10rem] truncate inline-block align-bottom" title={fullTitle}>
      {label}
    </span>
  );
}

type CompanyFetchState = {
  fetchedCompanyName: string | null;
  fetchingCompany: boolean;
};

type CompanyFetchAction =
  | { type: "reset" }
  | { type: "loading" }
  | { type: "loaded"; name: string | null };

function companyFetchReducer(_state: CompanyFetchState, action: CompanyFetchAction): CompanyFetchState {
  switch (action.type) {
    case "reset":
      return { fetchedCompanyName: null, fetchingCompany: false };
    case "loading":
      return { fetchedCompanyName: null, fetchingCompany: true };
    case "loaded":
      return { fetchedCompanyName: action.name, fetchingCompany: false };
    default:
      return { fetchedCompanyName: null, fetchingCompany: false };
  }
}

export function TopBar() {
  const { user, signOut, setCommandOpen, engagements, engagementsLoading } = useApp();
  const { openMobile } = useShellNav();
  const pathname = usePathname();
  const router = useRouter();
  const engagementId = useMemo(() => parseEngagementIdFromPath(pathname), [pathname]);
  const companyFromContext = useMemo(
    () => (engagementId ? findEngagementCompanyName(engagements, engagementId) : null),
    [engagements, engagementId],
  );
  const [companyFetch, dispatchCompanyFetch] = useReducer(companyFetchReducer, {
    fetchedCompanyName: null,
    fetchingCompany: false,
  });

  useEffect(() => {
    if (!engagementId || companyFromContext) {
      dispatchCompanyFetch({ type: "reset" });
      return;
    }

    let cancelled = false;
    dispatchCompanyFetch({ type: "loading" });
    const fetchEngagement =
      isUuid(engagementId) || /^e\d+$/.test(engagementId)
        ? fetchEngagementById(engagementId)
        : fetchEngagementBySlug(engagementId);

    void fetchEngagement
      .then((eng) => {
        if (cancelled) return;
        dispatchCompanyFetch({ type: "loaded", name: eng?.companyName ?? null });
      })
      .catch(() => {
        if (!cancelled) dispatchCompanyFetch({ type: "loaded", name: null });
      });

    return () => {
      cancelled = true;
    };
  }, [engagementId, companyFromContext]);

  const crumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean).slice(1);
    const companyName = companyFromContext ?? companyFetch.fetchedCompanyName;
    const projectLabel =
      companyName ??
      (engagementsLoading || companyFetch.fetchingCompany ? "Loading…" : "Project");

    return segments.map((segment, index) => {
      const isEngagementSegment = Boolean(engagementId && segment === engagementId);
      const label = breadcrumbLabel(segment, engagementId, projectLabel);
      const title = isEngagementSegment && companyName ? companyName : undefined;
      return { key: `${segment}-${index}`, label, title };
    });
  }, [
    pathname,
    engagementId,
    companyFromContext,
    companyFetch.fetchedCompanyName,
    engagementsLoading,
    companyFetch.fetchingCompany,
  ]);

  const pageTitle = pageTitleFromPath(pathname, user?.role);

  return (
    <header className="flex h-[3.75rem] items-center gap-2 rounded-2xl border border-border/50 bg-panel/80 px-2.5 shadow-[0_12px_40px_-22px_oklch(var(--shadow-ink)/0.22)] backdrop-blur-2xl sm:gap-3 sm:px-3.5">
      {/* Mobile-only nav opener — desktop collapse lives on the sidebar itself */}
      <button
        type="button"
        onClick={openMobile}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground sm:text-base">
          {pageTitle}
        </h1>
        <nav
          aria-label="Breadcrumb"
          className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden font-mono text-[10px] tracking-wide text-muted-foreground"
        >
          {user && (
            <span className="shrink-0 uppercase tracking-[0.12em] text-primary/80">
              {ROLE_UI_LABEL[user.role]}
            </span>
          )}
          {user?.role === "super_admin" && (
            <span className="super-gold-chip shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]">
              Super
            </span>
          )}
          {crumbs.length > 0 && user && <span className="shrink-0 text-border">·</span>}
          {crumbs.map((crumb, i) => (
            <span key={crumb.key} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span className="shrink-0 text-border">/</span>}
              <span
                className={
                  i === crumbs.length - 1
                    ? "min-w-0 font-medium capitalize text-primary"
                    : "min-w-0 capitalize"
                }
              >
                <TruncatedLabel label={crumb.label} title={crumb.title} />
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-9 min-h-[44px] items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-2.5 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary-light hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-9"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">Search</span>
          <span className="ml-0.5 hidden items-center gap-0.5 sm:flex">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </button>

        <NotificationsBell />

        <ThemeToggle />

        {user && (
          <AccentButton
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              void signOut()
                .then(() => router.push("/login"))
                .catch(() => {
                  toast.error("Sign out failed. Please try again.");
                });
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </AccentButton>
        )}
      </div>
    </header>
  );
}
