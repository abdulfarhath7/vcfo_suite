"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { CreateInternForm } from "@/components/admin/CreateInternForm";
import { SEO } from "@/components/SEO";
import { Surface } from "@/components/noir";
import { Loader2, Users } from "lucide-react";

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
        subtitle="Provision intern portal accounts and monitor GCC project workload."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Surface className="p-5 sm:p-6 h-fit">
          <CreateInternForm />
        </Surface>

        <Surface className="divide-y divide-border">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] mono uppercase tracking-[0.14em] text-text-tertiary">
              Active project leads
            </p>
          </div>
          {internsLoading ? (
            <div className="p-8 flex justify-center text-text-tertiary">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : roster.length === 0 ? (
            <p className="p-6 text-[13px] text-text-tertiary">
              No project leads in the database yet. Create one using the form.
            </p>
          ) : (
            roster.map((m) => (
              <div key={m.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-light text-brand text-[12px] font-semibold flex items-center justify-center">
                  {m.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">{m.name}</div>
                  <div className="text-[11.5px] text-text-tertiary font-mono truncate">
                    {m.id}
                  </div>
                  <div className="text-[11.5px] text-text-tertiary mt-0.5">
                    {m.myEng} GCC projects · {m.open} open tasks
                  </div>
                </div>
                <div className="w-40 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${m.load}%` }} />
                    </div>
                    <span className="text-[11px] text-text-tertiary tabular-nums w-10 text-right">
                      {m.load}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </Surface>
      </div>
    </PageTransition>
  );
}
