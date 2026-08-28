"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CalendarCheck2, Filter } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/admin/PageHeader";
import { Surface, Eyebrow, Mono, EmptyStateIllustrated } from "@/components/noir";
import { useComplianceFilings } from "@/hooks/use-compliance-filings";
import { findEngagementForClientUser } from "@/lib/checklist-state-key";
import { toneForKey, TONE_BADGE } from "@/components/common/IconChip";
import { cn } from "@/lib/utils";
import { SegmentedPicker } from "@/components/admin/SegmentedPicker";

type Category = "all" | "gst" | "tax" | "payroll" | "other";
type UploadFilter = "all" | "received" | "pending";

function categorize(authority: string): Exclude<Category, "all"> {
  const a = authority.toUpperCase();
  if (a === "GST") return "gst";
  if (a === "IT" || a.includes("TAX") && a !== "PT") return "tax";
  if (a === "EPFO" || a === "ESIC" || a === "PT" || a.includes("PAYROLL")) return "payroll";
  return "other";
}

/** Client-facing compliances with category + upload-received filters. */
export default function ClientCompliances() {
  const { user, engagements, getStateForEngagement } = useApp();
  const eng = useMemo(
    () => (user?.role === "client" ? findEngagementForClientUser(engagements, user) : null),
    [user, engagements],
  );
  const allFilings = useComplianceFilings(engagements, getStateForEngagement);
  const [category, setCategory] = useState<Category>("all");
  const [upload, setUpload] = useState<UploadFilter>("all");

  const mine = useMemo(() => {
    if (!eng) return [];
    return allFilings.filter((f) => f.engagementId === eng.id);
  }, [allFilings, eng]);

  const rows = useMemo(() => {
    return mine.filter((f) => {
      if (category !== "all" && categorize(f.authority) !== category) return false;
      const received = f.status === "filed" || f.status === "in-progress";
      if (upload === "received" && !received) return false;
      if (upload === "pending" && received) return false;
      return true;
    });
  }, [mine, category, upload]);

  if (!eng) {
    return (
      <EmptyStateIllustrated
        icon={CalendarCheck}
        title="No active engagement"
        className="mx-auto max-w-md"
      />
    );
  }

  const cats: { id: Category; label: string }[] = [
    { id: "all", label: "All" },
    { id: "gst", label: "GST" },
    { id: "tax", label: "Tax" },
    { id: "payroll", label: "Payroll" },
    { id: "other", label: "Other" },
  ];

  return (
    <PageTransition>
      <SEO
        title="Compliances — VCFO Suite"
        description="Your GST, tax, and payroll compliance obligations."
        path="/app/client/compliances"
      />
      <PageHeader
        accent="emerald"
        icon={CalendarCheck2}
        title="Compliances"
        subtitle={eng.companyName}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <SegmentedPicker
          value={category}
          options={cats.map((c) => ({ value: c.id, label: c.label }))}
          onChange={(next) => setCategory(next)}
          ariaLabel="Filter by category"
          size="sm"
          className="inline-grid"
        />
        <span className="mx-1 h-4 w-px bg-border" />
        <SegmentedPicker
          value={upload}
          options={[
            { value: "all", label: "All uploads" },
            { value: "received", label: "Upload received" },
            { value: "pending", label: "Awaiting upload" },
          ]}
          onChange={(next: UploadFilter) => setUpload(next)}
          ariaLabel="Filter by upload"
          size="sm"
          className="inline-grid"
        />
      </div>

      <Surface className="divide-y divide-border overflow-hidden">
        <div className="px-4 py-3">
          <Eyebrow>
            {rows.length} filing{rows.length === 1 ? "" : "s"}
          </Eyebrow>
        </div>
        {rows.length === 0 ? (
          <EmptyStateIllustrated
            icon={CalendarCheck}
            title="No matching compliances"
            description="Try a different category or upload filter."
            className="m-4 py-8"
          />
        ) : (
          rows.map((f) => {
            const received = f.status === "filed" || f.status === "in-progress";
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    <span className="truncate">{f.filing}</span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide',
                        TONE_BADGE[toneForKey(f.authority)],
                      )}
                    >
                      {f.authority}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {categorize(f.authority).toUpperCase()} · {f.frequency}
                  </div>
                </div>
                <Mono className="text-[11px] tabular-nums">
                  {new Date(f.nextDue).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Mono>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                    received
                      ? "bg-success-light text-success-text"
                      : "bg-warning-light text-warning-text",
                  )}
                >
                  {received ? "Upload received" : "Awaiting upload"}
                </span>
              </div>
            );
          })
        )}
      </Surface>
    </PageTransition>
  );
}
