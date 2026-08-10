"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useInternPortfolio } from "@/lib/use-intern-portfolio";
import { PageTransition, Stagger, StaggerItem } from "@/components/shell/PageTransition";
import { SEO } from "@/components/SEO";
import { StatusPill } from "@/components/common/StatusPill";
import { AccentButton, Surface, Eyebrow } from "@/components/noir";
import { AccentKpi } from "@/components/admin/AccentKpi";
import { checklist } from "@/data/checklist";
import { useRouter } from "next/navigation";
import { internEngagementPath } from "@/lib/project-step-path";
import { ArrowUpRight, Clock, Zap, BarChart3, CheckCircle2, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "framer-motion";
import { useClientLocaleDate } from "@/hooks/use-client-locale-date";

export default function InternToday() {
  const { user, engagements } = useApp();
  const { stats, focusActions } = useInternPortfolio();
  const router = useRouter();
  const dateLabel = useClientLocaleDate({ weekday: "long", month: "long", day: "numeric" });

  const weekActions = useMemo(() => {
    return focusActions.slice(0, 8);
  }, [focusActions]);

  return (
    <PageTransition>
      <SEO
        title="Today — VCFO Suite"
        description="Next up this week: open steps, client follow-ups, and delivery queue."
        path="/app/intern/today"
      />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>{dateLabel || "This week"}</Eyebrow>
          <h1 className="serif mt-1 text-3xl tracking-tight text-foreground">Next up this week</h1>
          {user?.name ? (
            <p className="mt-1 text-sm text-muted-foreground">{user.name.split(" ")[0]}</p>
          ) : null}
        </div>
        <AccentButton variant="outline" onClick={() => router.push("/app/intern/analytics")}>
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
          Analytics
        </AccentButton>
      </header>

      <Stagger>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StaggerItem>
            <AccentKpi
              label="On track"
              value={Math.max(0, stats.open.length - stats.overdue.length)}
              tone="success"
              icon={CheckCircle2}
              hint="Steps due this week"
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              label="Overdue"
              value={stats.overdue.length}
              tone={stats.overdue.length > 0 ? "warning" : "success"}
              icon={Clock}
              hint="Needs immediate action"
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              label="Queue health"
              value={`${stats.queuePct}%`}
              tone="info"
              icon={Gauge}
              hint="Completion across your book"
            />
          </StaggerItem>
        </div>
      </Stagger>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="serif text-xl text-foreground">Week queue</h2>
        <button
          type="button"
          onClick={() => router.push("/app/intern/clients")}
          className="flex min-h-[44px] items-center gap-1 px-1 text-xs text-role-foreground hover:underline sm:min-h-0"
        >
          Clients <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-3">
        {weekActions.length === 0 ? (
          <Surface className="p-10 text-center">
            <Zap className="mx-auto mb-3 h-8 w-8 text-role" />
            <p className="serif text-lg">Queue clear for this week</p>
            <p className="mt-1 text-sm text-muted-foreground">Check Clients or Compliance calendar for follow-ups.</p>
          </Surface>
        ) : (
          weekActions.map((item, i) => {
            const def = checklist.find((c) => c.id === item.checklistKey);
            const eng = engagements.find((e) => e.id === item.engagementId);
            const isOverdue = item.isOverdue;
            const href = eng ? internEngagementPath(eng) : "/app/intern/clients";
            return (
              <m.div
                key={`${item.engagementId}-${item.checklistKey}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                <Surface
                  interactive
                  className="flex flex-wrap items-center gap-4 p-4"
                  onClick={() => router.push(href)}
                >
                  <div
                    className={cn(
                      "w-1 shrink-0 self-stretch rounded-full",
                      isOverdue ? "bg-danger" : "bg-role",
                    )}
                  />
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm font-medium text-foreground">{def?.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{eng?.companyName}</div>
                  </div>
                  <StatusPill status={item.status} />
                  <AccentButton
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(href);
                    }}
                  >
                    Open step
                  </AccentButton>
                </Surface>
              </m.div>
            );
          })
        )}
      </div>
    </PageTransition>
  );
}
