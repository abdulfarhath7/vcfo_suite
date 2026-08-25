"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useApp } from "@/context/AppContext";
import {
  Briefcase,
  Inbox,
  LayoutDashboard,
  Plus,
  FolderClosed,
  BarChart3,
  Users,
  BookOpen,
  ClipboardCheck,
  History,
  CalendarCheck,
  Mail,
  Megaphone,
  Archive,
  Bell,
  Search,
  FileText,
} from "lucide-react";
import { adminProjectPath, internEngagementPath } from "@/lib/project-step-path";
import { useStaffBasePath } from "@/hooks/use-staff-base-path";
import { internVisibleDocuments } from "@/lib/document-access";
import {
  formatKnowledgeBankCommandHit,
  knowledgeBankFileMatchesQuery,
} from "@/lib/knowledge-bank-search";
import {
  collectIndexedVaultDocuments,
  collectVaultDocuments,
  formatVaultCommandHit,
  mergeVaultDocuments,
  scopeVaultDocumentsToEngagements,
  vaultFileNameMatches,
  type IndexedDocumentRow,
} from "@/lib/vault-documents";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

type PaletteFileHit = {
  id: string;
  label: string;
  href: string;
  value: string;
};

function staffLibraryPaths(role: Role | undefined, staffBase: string) {
  if (role === "intern") {
    return { vault: "/app/intern/vault", kb: "/app/intern/knowledge-bank" };
  }
  return { vault: `${staffBase}/vault`, kb: `${staffBase}/knowledge-bank` };
}

function useModShortcut() {
  const [isApple, setIsApple] = useState<boolean | null>(null);
  useEffect(() => {
    setIsApple(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);
  return isApple;
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, user, engagements, getStateForEngagement } = useApp();
  const router = useRouter();
  const staffBase = useStaffBasePath();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const [query, setQuery] = useState("");
  const [idleKey, setIdleKey] = useState(0);
  const [vaultHits, setVaultHits] = useState<PaletteFileHit[]>([]);
  const [kbHits, setKbHits] = useState<PaletteFileHit[]>([]);
  const isApple = useModShortcut();
  const canSearchLibraries =
    user?.role === "intern" || user?.role === "manager" || user?.role === "admin";
  const libraryPaths = staffLibraryPaths(user?.role, staffBase);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    if (!commandOpen) {
      setQuery("");
      if (wasOpen.current) setIdleKey((n) => n + 1);
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [commandOpen]);

  useEffect(() => {
    if (!commandOpen) return;
    const onPointer = (e: MouseEvent | PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) {
        setCommandOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setCommandOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onEsc);
    };
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    if (!commandOpen || !canSearchLibraries) {
      setVaultHits([]);
      setKbHits([]);
      return;
    }
    const q = query.trim();
    if (!q) {
      setVaultHits([]);
      setKbHits([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const encoded = encodeURIComponent(q);
        const vaultHref = `${libraryPaths.vault}?q=${encoded}`;
        const kbHref = `${libraryPaths.kb}?q=${encoded}`;
        try {
          const [docsRes, kbRes] = await Promise.all([
            fetch("/api/documents"),
            fetch("/api/knowledge-bank"),
          ]);
          const docsJson = (await docsRes.json().catch(() => null)) as
            | { documents?: IndexedDocumentRow[] }
            | null;
          const kbJson = (await kbRes.json().catch(() => null)) as
            | {
                files?: Array<{
                  id: string;
                  title: string;
                  fileName: string;
                  description?: string | null;
                  folderPath?: string | null;
                }>;
              }
            | null;

          if (cancelled) return;

          const milestoneDocs = collectVaultDocuments(engagements, getStateForEngagement);
          const indexedDocs = collectIndexedVaultDocuments(docsJson?.documents ?? [], engagements);
          let merged = scopeVaultDocumentsToEngagements(
            mergeVaultDocuments(milestoneDocs, indexedDocs),
            engagements,
          );
          if (user?.role === "intern") {
            merged = internVisibleDocuments(user.internId, merged, engagements);
          }

          setVaultHits(
            merged
              .filter((doc) => vaultFileNameMatches(doc, q))
              .slice(0, 8)
              .map((doc) => ({
                id: doc.id,
                label: formatVaultCommandHit(doc),
                href: vaultHref,
                value: `vault ${doc.fileName} ${doc.companyName} ${doc.bucket} ${doc.section}`,
              })),
          );

          const kbFiles = kbRes.ok ? kbJson?.files ?? [] : [];
          setKbHits(
            kbFiles
              .filter((file) => knowledgeBankFileMatchesQuery(file, q))
              .slice(0, 8)
              .map((file) => ({
                id: file.id,
                label: formatKnowledgeBankCommandHit(file),
                href: kbHref,
                value: `kb ${file.fileName} ${file.title} ${file.folderPath ?? ""}`,
              })),
          );
        } catch {
          if (!cancelled) {
            setVaultHits([]);
            setKbHits([]);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    canSearchLibraries,
    commandOpen,
    engagements,
    getStateForEngagement,
    libraryPaths.kb,
    libraryPaths.vault,
    query,
    user?.internId,
    user?.role,
  ]);

  const go = (to: string) => {
    setCommandOpen(false);
    setQuery("");
    router.push(to);
  };

  const itemClass = "rounded-lg px-2 py-2 text-[13px]";

  return (
    <div
      ref={rootRef}
      className={cn(
        "min-w-0",
        commandOpen
          ? "absolute inset-x-2 top-[7px] z-40 sm:relative sm:inset-x-auto sm:top-auto sm:z-auto sm:w-[min(100%,18rem)] sm:min-w-[8rem] sm:max-w-xs sm:flex-none sm:shrink"
          : "relative hidden min-w-[8rem] w-[min(100%,12.5rem)] max-w-xs shrink sm:block lg:w-[min(100%,16rem)]",
      )}
    >
      <Command
        key={idleKey}
        className="overflow-visible rounded-none bg-transparent text-foreground"
        shouldFilter
        loop
      >
        <div
          className={cn(
            "flex h-9 items-center gap-2 rounded-xl border bg-raised/50 px-3 text-[13px] text-muted-foreground transition-colors",
            commandOpen
              ? "border-primary/35 bg-raised text-foreground shadow-[0_0_0_3px_oklch(var(--primary)_/_0.12)]"
              : "border-border/70 hover:border-primary/30 hover:bg-raised hover:text-foreground",
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-primary/80" strokeWidth={1.75} aria-hidden />
          <CommandInput
            ref={inputRef}
            showIcon={false}
            wrapperClassName="flex min-w-0 flex-1 items-center border-0 p-0"
            onValueChange={(value) => {
              setQuery(value);
              if (!commandOpen) setCommandOpen(true);
            }}
            onFocus={() => setCommandOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                setCommandOpen(true);
              }
            }}
            placeholder="Search"
            aria-label="Search"
            aria-expanded={commandOpen}
            aria-keyshortcuts="Meta+K Control+K"
            className="h-9 py-0 text-[13px] text-foreground placeholder:text-muted-foreground"
          />
          {isApple != null && !query && (
            <span className="hidden shrink-0 items-center gap-0.5 lg:flex" aria-hidden>
              {isApple ? <span className="kbd">⌘</span> : <span className="kbd px-1">Ctrl</span>}
              <span className="kbd">K</span>
            </span>
          )}
        </div>

        <CommandList
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(22rem,70vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-border/70 bg-panel p-1 shadow-[0_16px_40px_-18px_oklch(22%_0.06_260_/_0.5)] ring-1 ring-primary/10",
            !commandOpen && "hidden",
          )}
        >
          <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">
            Nothing matched. Try another term.
          </CommandEmpty>
          {vaultHits.length > 0 && (
            <CommandGroup heading="Documents">
              {vaultHits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  className={itemClass}
                  value={hit.value}
                  onSelect={() => go(hit.href)}
                >
                  <FileText className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{hit.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {kbHits.length > 0 && (
            <CommandGroup heading="Knowledge Bank">
              {kbHits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  className={itemClass}
                  value={hit.value}
                  onSelect={() => go(hit.href)}
                >
                  <BookOpen className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{hit.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {user?.role === "super_admin" && (
            <CommandGroup heading="Super admin">
              <CommandItem className={itemClass} onSelect={() => go("/app/super/dashboard")}><LayoutDashboard className="w-4 h-4 mr-2" />Overview</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/super/announcements")}><Megaphone className="w-4 h-4 mr-2" />Announcements</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/super/notifications")}><Bell className="w-4 h-4 mr-2" />Notification history</CommandItem>
            </CommandGroup>
          )}
          {user?.role === "admin" && (
            <CommandGroup heading="Firm admin">
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/dashboard")}><LayoutDashboard className="w-4 h-4 mr-2" />Home</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/announcements")}><Megaphone className="w-4 h-4 mr-2" />Announcements</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/notifications")}><Bell className="w-4 h-4 mr-2" />Notification history</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/people")}><Users className="w-4 h-4 mr-2" />People</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/mail")}><Mail className="w-4 h-4 mr-2" />Send email</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/approvals")}><ClipboardCheck className="w-4 h-4 mr-2" />Approvals</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/compliance")}><CalendarCheck className="w-4 h-4 mr-2" />Compliance calendar</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/vault")}><FolderClosed className="w-4 h-4 mr-2" />Document vault</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/knowledge-bank")}><BookOpen className="w-4 h-4 mr-2" />Knowledge Bank</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/analytics")}><BarChart3 className="w-4 h-4 mr-2" />Analytics</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/audit-log")}><History className="w-4 h-4 mr-2" />Audit log</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/admin/projects/new")}><Plus className="w-4 h-4 mr-2" />New project</CommandItem>
            </CommandGroup>
          )}
          {user?.role === "manager" && (
            <CommandGroup heading="Project manager">
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/dashboard")}><LayoutDashboard className="w-4 h-4 mr-2" />Dashboard</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/announcements")}><Megaphone className="w-4 h-4 mr-2" />Announcements</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/notifications")}><Bell className="w-4 h-4 mr-2" />Notification history</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/projects")}><Briefcase className="w-4 h-4 mr-2" />GCC setup projects</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/approvals")}><ClipboardCheck className="w-4 h-4 mr-2" />Approvals</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/people")}><Users className="w-4 h-4 mr-2" />People</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/mail")}><Mail className="w-4 h-4 mr-2" />Send email</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/compliance")}><CalendarCheck className="w-4 h-4 mr-2" />Compliance calendar</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/vault")}><FolderClosed className="w-4 h-4 mr-2" />Document vault</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/knowledge-bank")}><BookOpen className="w-4 h-4 mr-2" />Knowledge Bank</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/analytics")}><BarChart3 className="w-4 h-4 mr-2" />Analytics</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/projects/new")}><Plus className="w-4 h-4 mr-2" />New project</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/manager/team")}><Users className="w-4 h-4 mr-2" />Project leads</CommandItem>
            </CommandGroup>
          )}
          {user?.role === "intern" && (
            <CommandGroup heading="Project Lead workbench">
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/today")}><LayoutDashboard className="w-4 h-4 mr-2" />Today</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/tasks")}><Briefcase className="w-4 h-4 mr-2" />My work</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/clients")}><Users className="w-4 h-4 mr-2" />Clients</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/vault")}><Archive className="w-4 h-4 mr-2" />Document vault</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/announcements")}><Megaphone className="w-4 h-4 mr-2" />Announcements</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/notifications")}><Bell className="w-4 h-4 mr-2" />Notification history</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/mail")}><Mail className="w-4 h-4 mr-2" />Send email</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/analytics")}><BarChart3 className="w-4 h-4 mr-2" />Analytics</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/compliance")}><CalendarCheck className="w-4 h-4 mr-2" />Compliance calendar</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/compliance/tracker")}><CalendarCheck className="w-4 h-4 mr-2" />Filing tracker</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/audit-log")}><History className="w-4 h-4 mr-2" />Audit log</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/intern/knowledge-bank")}><BookOpen className="w-4 h-4 mr-2" />Knowledge Bank</CommandItem>
            </CommandGroup>
          )}
          {user?.role === "client" && (
            <CommandGroup heading="Client portal">
              <CommandItem className={itemClass} onSelect={() => go("/app/client/inbox")}><Inbox className="w-4 h-4 mr-2" />Inbox</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/client/announcements")}><Megaphone className="w-4 h-4 mr-2" />Announcements</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/client/notifications")}><Bell className="w-4 h-4 mr-2" />Notification history</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/client/incorporation")}>Incorporation</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/client/compliances")}><CalendarCheck className="w-4 h-4 mr-2" />Compliances</CommandItem>
              <CommandItem className={itemClass} onSelect={() => go("/app/client/documents")}><FolderClosed className="w-4 h-4 mr-2" />Documents</CommandItem>
            </CommandGroup>
          )}
          {engagements.length > 0 && user?.role !== "client" && (
            <CommandGroup heading="Projects">
              {engagements.map((e) => (
                <CommandItem
                  key={e.id}
                  className={itemClass}
                  value={`${e.companyName} ${e.slug ?? ""} ${e.id}`}
                  onSelect={() =>
                    go(
                      user?.role === "admin" || user?.role === "manager"
                        ? adminProjectPath(e, staffBase)
                        : internEngagementPath(e),
                    )
                  }
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  {e.companyName}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
