"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  History,
  Inbox,
  Users,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { AccentKpi } from "@/components/admin/AccentKpi";
import { IconChip, type IconChipTone } from "@/components/common/IconChip";
import { SEO } from "@/components/SEO";
import { deriveStuckReason } from "@/lib/project-stuck";

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

export default function SuperDashboardPage() {
  const { engagements, getStateForEngagement } = useApp();

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
      <PageHeader
        title="Bird's-eye overview"
        subtitle="Jump into the firm console or any client portal. You can open every role workspace."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <AccentKpi label="Projects" value={pulse.total} tone="primary" icon={Briefcase} />
        <AccentKpi
          label="Needs attention"
          value={pulse.attention}
          tone="warning"
          icon={AlertTriangle}
        />
        <AccentKpi label="On track" value={pulse.onTrack} tone="success" icon={CheckCircle2} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LAUNCHERS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-border/70 bg-panel p-4 transition-colors hover:border-primary/40 hover:bg-primary-light/40"
          >
            <IconChip icon={card.icon} tone={card.tone} className="mb-3" />
            <p className="text-sm font-semibold text-foreground">{card.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-border/70 bg-panel p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <IconChip icon={Users} tone="info" size="sm" />
          All GCC setup projects ({engagements.length})
        </div>
        {engagements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {engagements.map((eng) => (
              <li key={eng.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{eng.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {eng.stage} · {eng.health}
                    {eng.clientEmail ? ` · ${eng.clientEmail}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/app/admin/projects/${eng.slug ?? eng.id}`}
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:bg-raised"
                  >
                    Firm view
                  </Link>
                  <Link
                    href="/app/client/incorporation"
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:bg-raised"
                  >
                    Client portal
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageTransition>
  );
}
