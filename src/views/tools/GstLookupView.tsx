"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Fingerprint,
  Search,
  RefreshCw,
  Building2,
  MapPin,
  ShieldCheck,
  Briefcase,
  Loader2,
} from "lucide-react";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { DashSection } from "@/components/dash/DashSection";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isValidGstin } from "@/lib/gst-lookup/validate";
import type { NormalizedGstData, HsnItem } from "@/lib/gst-lookup/types";

interface LookupResult {
  data: NormalizedGstData;
  cached: boolean;
  fetchedAt: string;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-44 shrink-0 text-[13px] text-ink-muted">{label}</dt>
      <dd className="text-[14px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function HsnTable({ items, title }: { items: HsnItem[]; title: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h4 className="mb-2 text-[13px] font-medium text-ink-muted">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line-soft text-left text-ink-muted">
              <th className="pb-2 pr-4 font-medium">Code</th>
              <th className="pb-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-line-soft last:border-b-0">
                <td className="py-2 pr-4 font-mono text-ink">{item.code || "—"}</td>
                <td className="py-2 text-ink">{item.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GstLookupView() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (refresh = false) => {
      const gstin = query.trim().toUpperCase();
      if (!isValidGstin(gstin)) {
        setError("Enter a valid 15-character GSTIN/UIN.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/tools/gst-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gstin, refresh }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? `Lookup failed (${res.status}).`);
          setResult(null);
        } else {
          setResult({ data: json.data, cached: json.cached, fetchedAt: json.fetchedAt });
        }
      } catch {
        setError("Network error — could not reach the server.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  const d = result?.data;

  return (
    <PageTransition>
      <SEO title="GST Lookup" description="Search taxpayer details by GSTIN/UIN" path={pathname} />
      <PageHeader
        title="GST Lookup"
        icon={Fingerprint}
        subtitle="Search taxpayer details by GSTIN/UIN"
      />

      {/* Search bar */}
      <div className="mb-6 flex gap-2">
        <Input
          placeholder="Enter GSTIN e.g. 36ADNFS2022G1Z6"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          className="max-w-sm font-mono tracking-wide"
          maxLength={15}
        />
        <Button onClick={() => lookup()} disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Search />
          )}
          Search
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-danger/30 bg-danger-fill/10 px-4 py-3 text-[14px] text-danger">
          {error}
        </div>
      )}

      {!d && !error && !loading && (
        <EmptyState title="Enter a GSTIN above to look up taxpayer details." />
      )}

      {d && (
        <div className="space-y-4">
          {/* Header card */}
          <DashSection
            title={d.legalName || d.gstin}
            meta={d.tradeName && d.tradeName !== d.legalName ? d.tradeName : undefined}
            headIcon={{ icon: Building2, tone: "blue" }}
            right={
              <div className="flex items-center gap-3 text-[13px] text-ink-muted">
                {result.cached && (
                  <span>Cached {formatTimeAgo(result.fetchedAt)}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => lookup(true)}
                  disabled={loading}
                >
                  <RefreshCw className={loading ? "animate-spin" : ""} />
                  Refresh
                </Button>
              </div>
            }
          >
            <dl className="space-y-2">
              <InfoRow label="GSTIN/UIN" value={d.gstin} />
              <InfoRow label="Legal name" value={d.legalName} />
              <InfoRow label="Trade name" value={d.tradeName} />
              <InfoRow label="Status" value={d.status} />
              <InfoRow label="Taxpayer type" value={d.taxpayerType} />
              <InfoRow label="Constitution" value={d.constitution} />
            </dl>
          </DashSection>

          {/* Registration */}
          <DashSection title="Registration" headIcon={{ icon: Fingerprint, tone: "violet" }}>
            <dl className="space-y-2">
              <InfoRow label="Registration date" value={d.registrationDate} />
              <InfoRow label="Cancellation date" value={d.cancellationDate} />
              <InfoRow label="Last updated" value={d.lastUpdated} />
              <InfoRow label="E-invoice status" value={d.einvoiceStatus} />
            </dl>
          </DashSection>

          {/* Jurisdiction */}
          <DashSection title="Jurisdiction" headIcon={{ icon: MapPin, tone: "teal" }}>
            <dl className="space-y-2">
              <InfoRow label="Centre jurisdiction" value={d.centerJurisdiction} />
              <InfoRow label="State jurisdiction" value={d.stateJurisdiction} />
              <InfoRow label="Principal address" value={d.principalAddress} />
            </dl>
          </DashSection>

          {/* Verification */}
          <DashSection title="Verification" headIcon={{ icon: ShieldCheck, tone: "green" }}>
            <dl className="space-y-2">
              <InfoRow label="Aadhaar authenticated" value={d.aadhaarAuthenticated} />
              <InfoRow label="Aadhaar date" value={d.aadhaarDate} />
              <InfoRow label="e-KYC verified" value={d.ekycVerified} />
            </dl>
          </DashSection>

          {/* Business activities + HSN */}
          <DashSection title="Business activities" headIcon={{ icon: Briefcase, tone: "blue" }}>
            <dl className="space-y-2">
              {d.coreActivity.length > 0 && (
                <InfoRow label="Nature of business" value={d.coreActivity.join(", ")} />
              )}
              {d.businessActivities.length > 0 &&
                d.businessActivities !== d.coreActivity && (
                  <InfoRow label="Activities" value={d.businessActivities.join(", ")} />
                )}
              {d.additionalTradeNames.length > 0 && (
                <InfoRow label="Additional trade names" value={d.additionalTradeNames.join(", ")} />
              )}
            </dl>
            <HsnTable items={d.hsnGoods} title="HSN — Goods" />
            <HsnTable items={d.hsnServices} title="SAC — Services" />
          </DashSection>
        </div>
      )}
    </PageTransition>
  );
}
