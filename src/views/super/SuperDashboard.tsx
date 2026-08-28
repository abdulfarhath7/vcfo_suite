"use client";

import Link from "next/link";
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { useMemo } from "react";
import {
  Activity,
  Building2,
  Eye,
  History,
  Inbox,
  Rocket,
  Users,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { SEO } from "@/components/SEO";
import { DashHero } from "@/components/dash/DashHero";
import { DashSection, DashDonut, DashLegendRow } from "@/components/dash/DashSection";
import { IconChip, TONE_BADGE, toneForKey, type IconChipTone } from "@/components/common/IconChip";
import { LeadFocusCard } from "@/components/intern/LeadFocusCard";
import { TeamTodosPanel } from "@/components/staff/TeamTodosPanel";
import { deriveStuckReason } from "@/lib/project-stuck";
import { internFirstName, internGreeting, internGreetingHour } from "@/lib/intern-work";
import { initialsFromName } from "@/lib/auth";
import type { Engagement } from "@/data/engagements";

const LAUNCHERS: {
  href: string;
  label: string;
  desc: string;
  icon: typeof Building2;
  tone: IconChipTone;
}[] = [
  {
    href: "/app/admin/dashboard",
    label: "Firm console",
    desc: "Projects, people, approvals",
    icon: Building2,
    tone: "primary",
  },
  {
    href: "/app/client/inbox",
    label: "Client portal",
    desc: "See the client-side experience",
    icon: Inbox,
    tone: "violet",
  },
  {
    href: "/app/admin/audit-log",
    label: "Firm audit",
    desc: "Full activity across engagements",
    icon: History,
    tone: "info",
  },
  {
    href: "/app/client/audit",
    label: "Client audit",
    desc: "Same trail from the client lens",
    icon: Eye,
    tone: "warning",
  },
];

const HEALTH_PILL: Record<Engagement["health"], { label: string; badge: string }> = {
  "on-track": { label: "On track", badge: TONE_BADGE.success },
  "at-risk": { label: "At risk", badge: TONE_BADGE.warning },
  overdue: { label: "Overdue", badge: TONE_BADGE.danger },
};

const STAGE_PILL: Record<Engagement["stage"], string> = {
  "Pre-Incorporation": TONE_BADGE.sky,
  "Post-Incorporation": TONE_BADGE.violet,
  "Operational Readiness": TONE_BADGE.teal,
};

export default function SuperDashboardPage() {
  const { user, engagements, getStateForEngagement } = useApp();
  const greet = internGreeting(internGreetingHour(new Date()));
  const first = internFirstName(user?.name ?? "");

  const pulse = useMemo(() => {
    let total = 0;
    let attention = 0;
    let onTrack = 0;
    for (const eng of engagements) {
      total += 1;
      if (eng.stage === "Operational Readiness") continue;
      const reason = deriveStuckReason(eng, getStateForEngagement(eng));
      if (reason === "on_track") onTrack += 1;
      else attention += 1;
    }
    return { total, attention, onTrack };
  }, [engagements, getStateForEngagement]);

  return (
    <PageTransition>
      <SEO
        title="Super Admin — VCFO Suite"
        description="Bird's-eye view across firm and client workspaces."
        path="/app/super/dashboard"
      />

      <div className="flex flex-col gap-3">
        <DashHero
          kicker="Bird's-eye · firm + client"
          title={`Good ${greet}, ${first}`}
          ring={{ value: pulse.onTrack, total: pulse.total, caption: "on track" }}
          stats={[
            { label: "projects", value: pulse.total },
            { label: "need attention", value: pulse.attention, hot: pulse.attention > 0 },
            { label: "on track", value: pulse.onTrack },
          ]}
        />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            {user?.id ? (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                <LeadFocusCard userId={user.id} items={[]} />
                <TeamTodosPanel userId={user.id} />
              </div>
            ) : null}

            <DashSection icon={Users} tone="info" title="All projects" meta={engagements.length}>
              {engagements.length === 0 ? (
                <p className="py-3 text-center text-[12.5px] text-muted-foreground">
                  No projects yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {engagements.map((eng) => {
                    const health = HEALTH_PILL[eng.health];
                    return (
                      <li key={eng.id} className="flex flex-wrap items-center gap-3 py-2.5">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${TONE_BADGE[toneForKey(eng.id)]}`}
                        >
                          {initialsFromName(eng.companyName).slice(0, 2)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {eng.companyName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${STAGE_PILL[eng.stage]}`}
                            >
                              {stageDisplayLabel(eng.stage)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${health.badge}`}
                            >
                              {health.label}
                            </span>
                            {eng.clientEmail ? (
                              <span className="truncate text-[11px] text-muted-foreground">
                                {eng.clientEmail}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <Link
                            href={`/app/admin/projects/${eng.slug ?? eng.id}`}
                            className="rounded-full border border-border px-3 py-1 text-[11px] font-bold text-ink transition-colors hover:border-primary/40 hover:bg-primary-light/40 hover:text-primary"
                          >
                            Firm view
                          </Link>
                          <Link
                            href="/app/client/incorporation"
                            className="rounded-full border border-border px-3 py-1 text-[11px] font-bold text-ink transition-colors hover:border-primary/40 hover:bg-primary-light/40 hover:text-primary"
                          >
                            Client portal
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DashSection>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <DashSection icon={Activity} tone="success" title="Portfolio health">
              <div className="flex min-w-0 items-center gap-3">
                <DashDonut
                  segments={[
                    { n: pulse.onTrack, color: "oklch(var(--success))" },
                    { n: pulse.attention, color: "oklch(var(--warning))" },
                  ]}
                  centerLabel={pulse.total}
                  centerCaption="projects"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <DashLegendRow swatchClassName="bg-success" label="On track" count={pulse.onTrack} />
                  <DashLegendRow
                    swatchClassName="bg-warning"
                    label="Needs attention"
                    count={pulse.attention}
                  />
                </div>
              </div>
            </DashSection>

            <DashSection icon={Rocket} tone="violet" title="Quick launch" meta={LAUNCHERS.length}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {LAUNCHERS.map((card) => (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-panel p-3 transition-colors hover:border-primary/40 hover:bg-primary-light/40"
                  >
                    <IconChip icon={card.icon} tone={card.tone} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {card.label}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {card.desc}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </DashSection>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
