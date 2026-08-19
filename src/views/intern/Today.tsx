"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useInternPortfolio } from "@/lib/use-intern-portfolio";
import { PageTransition, Stagger, StaggerItem } from "@/components/shell/PageTransition";
import { SEO } from "@/components/SEO";
import { Surface } from "@/components/noir";
import { AccentKpi } from "@/components/admin/AccentKpi";
import { checklist } from "@/data/checklist";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { internEngagementPath, internEngagementStepPath } from "@/lib/project-step-path";
import { ArrowUpRight, Clock, Zap, CheckCircle2, Gauge, ChevronRight } from "lucide-react";
import { m, useReducedMotion } from "framer-motion";
import { useClientLocaleNow } from "@/hooks/use-client-locale-date";
import { InternStepDoneMark } from "@/components/incorporation/InternStepDoneMark";
import { groupInternWeekQueueByCompany, type InternQueueItem } from "@/lib/intern-dashboard";
import type { Engagement } from "@/data/engagements";
import { MilestoneResponseRowSummary } from "@/views/incorporation/MilestoneResponseRowSummary";
import { extractItemResponses } from "@/lib/checklist-responses";
import { gateActiveCatalog, getStepGate } from "@/lib/checklist-step-gate";
import type { ChecklistItemStateSlice } from "@/lib/checklist-state-key";
import { cardHover, pressScale } from "@/lib/motion";

const checklistById = new Map(checklist.map((item) => [item.id, item]));

function InternWeekQueueRow({
  item,
  done,
  engagement,
  checklistState,
}: {
  item: InternQueueItem;
  done: boolean;
  engagement: Engagement;
  checklistState: Record<string, ChecklistItemStateSlice>;
}) {
  const def = checklistById.get(item.checklistKey);
  if (!def) return null;

  const responses = extractItemResponses(def, checklistState[def.id]);
  const waiting = item.status === "awaiting-client";

  return (
    <Link
      href={internEngagementStepPath(engagement, def)}
      className="group grid min-h-11 w-full grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-raised/40"
    >
      <InternStepDoneMark done={done} />
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ink">{def.title}</div>
        {waiting ? (
          <div className="mt-0.5 text-[11px] text-warning-text">Waiting on the client…</div>
        ) : null}
        <MilestoneResponseRowSummary item={def} responses={responses} variant="admin" hideStatus />
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function InternToday() {
  const { getStateForEngagement } = useApp();
  const { stats, queue, myEngagements } = useInternPortfolio();
  const router = useRouter();
  const nowLabel = useClientLocaleNow();
  const reduceMotion = useReducedMotion();
  const [weekday, date, time] = nowLabel.split(" · ");

  const engagementById = useMemo(
    () => new Map(myEngagements.map((e) => [e.id, e])),
    [myEngagements],
  );

  const weekQueueByCompany = useMemo(
    () => groupInternWeekQueueByCompany(queue, myEngagements),
    [queue, myEngagements],
  );

  return (
    <PageTransition>
      <SEO
        title="Today — VCFO Suite"
        description="Open steps, client follow-ups, and delivery queue."
        path="/app/intern/today"
      />

      <p className="serif mb-5 text-xl tracking-tight text-foreground">
        {nowLabel ? (
          <>
            {weekday} · {date}
            <span className="font-semibold tabular-nums"> · {time}</span>
          </>
        ) : (
          "\u00a0"
        )}
      </p>

      <Stagger>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StaggerItem>
            <AccentKpi
              label="On track"
              value={Math.max(0, stats.open.length - stats.overdue.length)}
              tone="success"
              icon={CheckCircle2}
              hint="Steps due this week"
              interactive
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              label="Overdue"
              value={stats.overdue.length}
              tone={stats.overdue.length > 0 ? "warning" : "success"}
              icon={Clock}
              hint="Needs immediate action"
              interactive
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              label="Queue health"
              value={`${stats.queuePct}%`}
              tone="info"
              icon={Gauge}
              hint="Completion across your book"
              interactive
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

      {weekQueueByCompany.length === 0 ? (
        <Surface className="p-10 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-role" />
          <p className="serif text-lg">Queue clear for this week</p>
          <p className="mt-1 text-sm text-muted-foreground">Check Clients or Compliance calendar for follow-ups.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {weekQueueByCompany.map((group, i) => {
            const eng = engagementById.get(group.engagementId);
            if (!eng) return null;
            const checklistState = getStateForEngagement(eng);
            const gates = gateActiveCatalog(checklistState, "intern");
            const subtitle = group.stage
              ? `${group.stage} · ${group.items.length} steps`
              : `${group.items.length} steps`;
            return (
              <m.div
                key={group.engagementId}
                className="h-full min-w-0"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.04 * i }}
                whileHover={reduceMotion ? undefined : cardHover.whileHover}
                whileTap={reduceMotion ? undefined : pressScale.whileTap}
              >
                <div className="surface h-full overflow-hidden">
                  <div className="flex w-full items-center justify-start border-b border-border bg-muted/25 px-4 py-2 text-left">
                    <Link
                      href={internEngagementPath(eng)}
                      className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="truncate text-[12px] font-medium text-ink hover:underline">
                        {group.companyName}
                      </div>
                      <div className="text-[11px] text-text-tertiary">{subtitle}</div>
                    </Link>
                  </div>
                  {group.items.map((item) => (
                    <InternWeekQueueRow
                      key={`${item.engagementId}-${item.checklistKey}`}
                      item={item}
                      done={getStepGate(gates, item.checklistKey).kind === "done"}
                      engagement={eng}
                      checklistState={checklistState}
                    />
                  ))}
                </div>
              </m.div>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
