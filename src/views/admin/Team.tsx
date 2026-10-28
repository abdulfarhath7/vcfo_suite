"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { CreateInternForm } from "@/components/admin/CreateInternForm";
import { SEO } from "@/components/SEO";
import { EFilingGrid, type EFilingColumn } from "@/components/dash/EFilingGrid";
import { EmptyState, SkeletonRows } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { PeopleCard, PersonAvatar } from "./firm-people/parts";
import { Users } from "lucide-react";

type RosterRow = { id: string; name: string; open: number; myEng: number; load: number };

/** Load bar tone (prototype `loadTone`): over 95% is red, over 80% amber, else blurple. */
const loadTone = (n: number) => (n > 95 ? "bg-danger-mid" : n > 80 ? "bg-warning-mid" : "bg-brand");

/**
 * Project leads (prototype `LeadsScreen`): the add-lead form in one card and the active leads
 * as a T1 grid (R-07) with projects, open tasks and a load bar.
 */
export default function Team() {
  const { internOptions, internsLoading, tasks, engagements } = useApp();

  const roster = useMemo(() => {
    const list = internOptions ?? [];
    return list.map((m) => {
      const myTasks = tasks.filter((t) => t.assigneeId === m.id);
      const open = myTasks.filter((t) => t.status !== "completed").length;
      const myEng = engagements.filter((e) => e.internId === m.id).length;
      const load = Math.min(100, Math.round((open / 30) * 100));
      return { ...m, open, myEng, load };
    });
  }, [internOptions, tasks, engagements]);

  const columns: EFilingColumn<RosterRow>[] = [
    {
      key: "name",
      header: "Project lead",
      render: (m) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar name={m.name} />
          <span className="min-w-0">
            <b className="block truncate font-medium text-ink">{m.name}</b>
            <span className="block truncate font-mono text-[12px] text-ink-muted">{m.id}</span>
          </span>
        </span>
      ),
    },
    { key: "projects", header: "Projects", width: "96px", align: "right", render: (m) => <span className="tabular-nums">{m.myEng}</span> },
    { key: "open", header: "Open tasks", width: "110px", align: "right", render: (m) => <span className="tabular-nums">{m.open}</span> },
    {
      key: "load",
      header: "Load",
      width: "160px",
      render: (m) => (
        <span className="flex items-center gap-2">
          <span className="relative block h-2 w-[80px] overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
            <i className={cn("absolute inset-y-0 left-0 rounded-bar", loadTone(m.load))} style={{ width: `${m.load}%` }} />
          </span>
          <span className="text-[12.5px] tabular-nums text-ink-muted">{m.load}%</span>
        </span>
      ),
    },
  ];

  return (
    <PageTransition>
      <SEO
        title="Project leads — VCFO Suite"
        description="Create project lead accounts and review delivery workload."
        path="/app/manager/team"
      />

      <PageHeader
        accent="violet"
        icon={Users}
        title="Project leads"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <PeopleCard title="Add project lead" className="h-fit">
          <div className="p-4 sm:p-5">
            <CreateInternForm />
          </div>
        </PeopleCard>

        <PeopleCard title="Active project leads" count={internsLoading ? undefined : roster.length}>
          {internsLoading ? (
            <SkeletonRows className="p-4" />
          ) : roster.length === 0 ? (
            <EmptyState title="No project leads yet" className="m-4" />
          ) : (
            <div className="px-2 pb-2">
              <EFilingGrid caption="Active project leads" columns={columns} rows={roster} rowKey={(m) => m.id} pageSize={12} minWidth={520} />
            </div>
          )}
        </PeopleCard>
      </div>
    </PageTransition>
  );
}
