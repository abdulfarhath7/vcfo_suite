"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useApp } from "@/context/AppContext";
import { Briefcase, Inbox, LayoutDashboard, Plus, FolderClosed, BarChart3, Users, BookOpen, ClipboardCheck, History, CalendarCheck } from "lucide-react";
import { adminProjectPath, internEngagementPath } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';

export function CommandPalette() {
  const { commandOpen, setCommandOpen, user, engagements } = useApp();
  const router = useRouter();
  const staffBase = useStaffBasePath();

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

  const go = (to: string) => {
    setCommandOpen(false);
    router.push(to);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Go to a page or project…" />
      <CommandList>
        <CommandEmpty>Nothing matched. Try another term.</CommandEmpty>
        {user?.role === "admin" && (
          <CommandGroup heading="Firm admin">
            <CommandItem onSelect={() => go("/app/admin/dashboard")}><LayoutDashboard className="w-4 h-4 mr-2" />Home</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/people")}><Users className="w-4 h-4 mr-2" />People</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/approvals")}><ClipboardCheck className="w-4 h-4 mr-2" />Approvals</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/compliance")}><CalendarCheck className="w-4 h-4 mr-2" />Compliance calendar</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/vault")}><FolderClosed className="w-4 h-4 mr-2" />Document vault</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/knowledge-bank")}><BookOpen className="w-4 h-4 mr-2" />Knowledge Bank</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/analytics")}><BarChart3 className="w-4 h-4 mr-2" />Analytics</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/audit-log")}><History className="w-4 h-4 mr-2" />Audit log</CommandItem>
            <CommandItem onSelect={() => go("/app/admin/projects/new")}><Plus className="w-4 h-4 mr-2" />New project</CommandItem>
          </CommandGroup>
        )}
        {user?.role === "manager" && (
          <CommandGroup heading="Project manager">
            <CommandItem onSelect={() => go("/app/manager/dashboard")}><LayoutDashboard className="w-4 h-4 mr-2" />Dashboard</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/projects")}><Briefcase className="w-4 h-4 mr-2" />GCC setup projects</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/approvals")}><ClipboardCheck className="w-4 h-4 mr-2" />Approvals</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/people")}><Users className="w-4 h-4 mr-2" />People</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/compliance")}><CalendarCheck className="w-4 h-4 mr-2" />Compliance calendar</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/vault")}><FolderClosed className="w-4 h-4 mr-2" />Document vault</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/knowledge-bank")}><BookOpen className="w-4 h-4 mr-2" />Knowledge Bank</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/analytics")}><BarChart3 className="w-4 h-4 mr-2" />Analytics</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/projects/new")}><Plus className="w-4 h-4 mr-2" />New project</CommandItem>
            <CommandItem onSelect={() => go("/app/manager/team")}><Users className="w-4 h-4 mr-2" />Project leads</CommandItem>
          </CommandGroup>
        )}
        {user?.role === "intern" && (
          <CommandGroup heading="Project Lead workbench">
            <CommandItem onSelect={() => go("/app/intern/today")}><LayoutDashboard className="w-4 h-4 mr-2" />Today</CommandItem>
            <CommandItem onSelect={() => go("/app/intern/clients")}><Users className="w-4 h-4 mr-2" />Clients</CommandItem>
            <CommandItem onSelect={() => go("/app/intern/analytics")}><BarChart3 className="w-4 h-4 mr-2" />Analytics</CommandItem>
            <CommandItem onSelect={() => go("/app/intern/compliance")}><CalendarCheck className="w-4 h-4 mr-2" />Compliance calendar</CommandItem>
            <CommandItem onSelect={() => go("/app/intern/audit-log")}><History className="w-4 h-4 mr-2" />Audit log</CommandItem>
            <CommandItem onSelect={() => go("/app/intern/knowledge-bank")}><BookOpen className="w-4 h-4 mr-2" />Knowledge Bank</CommandItem>
          </CommandGroup>
        )}
        {user?.role === "client" && (
          <CommandGroup heading="Client portal">
            <CommandItem onSelect={() => go("/app/client/inbox")}><Inbox className="w-4 h-4 mr-2" />Inbox</CommandItem>
            <CommandItem onSelect={() => go("/app/client/incorporation")}>Incorporation</CommandItem>
            <CommandItem onSelect={() => go("/app/client/compliances")}><CalendarCheck className="w-4 h-4 mr-2" />Compliances</CommandItem>
            <CommandItem onSelect={() => go("/app/client/documents")}><FolderClosed className="w-4 h-4 mr-2" />Documents</CommandItem>
          </CommandGroup>
        )}
        {engagements.length > 0 && user?.role !== "client" && (
          <CommandGroup heading="Projects">
            {engagements.map((e) => (
              <CommandItem
                key={e.id}
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
    </CommandDialog>
  );
}
