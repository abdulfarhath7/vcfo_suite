"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  IdCard,
  Landmark,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { DashSection } from "@/components/dash/DashSection";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Chip } from "@/components/ui/spectrum-chip";
import { companyStatusKind, dinStatusKind, kycKind } from "@/lib/din-lookup/status";
import { useMcaDinRequest } from "@/hooks/use-mca-din-request";
import { isValidDin } from "@/lib/din-lookup/validate";
import type { DinSource, DirectorAssociation, NormalizedDinData } from "@/lib/din-lookup/types";

/**
 * MCA Lookup: the shape of the portal's Master Data Services, in the Suite's own skin.
 * A person types a number, picks what it is, and the result appears below — the result row
 * first, as the portal lists it, and then the full "View Director / Designated Partner
 * Details" report, which on the portal needs a second click.
 */

interface LookupResult {
  data: NormalizedDinData;
  cached: boolean;
  source: DinSource;
  fetchedAt: string;
}

type SearchKind = "director" | "company";

const SOURCE_LABEL: Record<DinSource, string> = {
  falcon: "MCA master data via FalconeBiz",
  "mca-portal": "Read from the MCA portal in your own session",
};

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
      <dt className="w-56 shrink-0 text-[13px] text-ink-muted">{label}</dt>
      <dd className="text-[14px] font-medium text-ink">{value}</dd>
    </div>
  );
}

/**
 * The report's association table. Its columns are the MCA report's own, but a column is only
 * drawn when some row has it, so the FalconeBiz answer (which carries fewer columns) does not
 * leave a wall of dashes.
 */
const COLUMNS: Array<{
  key: keyof DirectorAssociation;
  head: (llp: boolean) => string;
  mono?: boolean;
  width?: string;
}> = [
  { key: "companyName", head: (llp) => (llp ? "LLP name" : "Company name") },
  { key: "cin", head: (llp) => (llp ? "LLPIN" : "CIN / FCRN"), mono: true, width: "w-[200px]" },
  { key: "companyStatus", head: () => "Status", width: "w-[110px]" },
  { key: "designation", head: () => "Designation", width: "w-[150px]" },
  { key: "appointmentCategory", head: () => "Category", width: "w-[110px]" },
  { key: "appointmentDate", head: () => "Appointed", mono: true, width: "w-[110px]" },
  { key: "currentDesignationDate", head: () => "At current designation", mono: true, width: "w-[130px]" },
  { key: "cessationDate", head: () => "Ceased", mono: true, width: "w-[110px]" },
];

function AssociationTable({ rows, llp }: { rows: DirectorAssociation[]; llp: boolean }) {
  const columns = COLUMNS.filter((c) => c.key === "companyName" || c.key === "cin" || rows.some((r) => r[c.key]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line-soft text-left align-bottom text-ink-muted">
            <th className="w-10 pb-2 pr-3 font-medium">#</th>
            {columns.map((c) => (
              <th key={c.key} className={`pb-2 pr-4 font-medium ${c.width ?? ""}`}>
                {c.head(llp)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.cin}-${row.designation}-${row.appointmentDate}-${i}`}
              className={`border-b border-line-soft last:border-b-0 ${row.cessationDate ? "text-ink-muted" : ""}`}
            >
              <td className="py-2 pr-3 font-mono text-ink-muted">{i + 1}</td>
              {columns.map((c) => {
                const value = row[c.key] as string;
                if (c.key === "companyStatus" && value) {
                  return (
                    <td key={c.key} className="py-2 pr-4">
                      <Chip tone={companyStatusKind(value)} raw>{value}</Chip>
                    </td>
                  );
                }
                return (
                  <td key={c.key} className={`py-2 pr-4 ${c.mono ? "font-mono" : ""} ${row.cessationDate ? "" : "text-ink"}`}>
                    {value || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssociationCard({ title, rows, llp = false }: { title: string; rows: DirectorAssociation[]; llp?: boolean }) {
  if (!rows.length) return null;
  const current = rows.filter((r) => !r.cessationDate);
  const past = rows.filter((r) => r.cessationDate);
  const meta = past.length ? `${current.length} current · ${past.length} ceased` : `${current.length} on record`;
  return (
    <DashSection title={title} meta={meta} headIcon={{ icon: Building2, tone: "violet" }}>
      {current.length > 0 && <AssociationTable rows={current} llp={llp} />}
      {past.length > 0 && (
        <div className={current.length > 0 ? "mt-5" : ""}>
          <h4 className="mb-2 text-[13px] font-medium text-ink-muted">Ceased appointments ({past.length})</h4>
          <AssociationTable rows={past} llp={llp} />
        </div>
      )}
    </DashSection>
  );
}

/** The portal's own result row: serial number, name, and the number that was searched. */
function ResultsRow({ data }: { data: NormalizedDinData }) {
  return (
    <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3" data-print="hide">
      <p className="mb-2 text-[13px] text-ink-muted">Showing results 1 of 1</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line-soft text-left text-ink-muted">
              <th className="w-16 pb-2 pr-4 font-medium">S. No.</th>
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="w-[160px] pb-2 font-medium">DIN/DPIN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pt-2 pr-4 font-mono text-ink-muted">1</td>
              <td className="pt-2 pr-4 font-medium text-ink">{data.name || "—"}</td>
              <td className="pt-2 font-mono text-ink">{data.din}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function McaLookupView() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<SearchKind>("director");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mca = useMcaDinRequest(
    useCallback((r) => {
      setResult({ data: r.data, cached: false, source: r.source, fetchedAt: r.fetchedAt });
      setError(null);
    }, []),
  );

  /** The portal takes a name or a number; this tool takes the number, so say so plainly. */
  const checkQuery = useCallback((): string | null => {
    const value = query.trim();
    if (!value) {
      setError("Enter a DIN or DPIN to search.");
      return null;
    }
    if (!isValidDin(value)) {
      setError(
        /^\d+$/.test(value)
          ? "A DIN or DPIN is exactly 8 digits."
          : "Enter the 8-digit DIN or DPIN. Searching by name is only on the MCA portal.",
      );
      return null;
    }
    setError(null);
    return value;
  }, [query]);

  /** Ask the person's own MCA tab, through the VCFO Assist extension. */
  const askMca = useCallback(() => {
    const din = checkQuery();
    if (din) void mca.ask(din);
  }, [checkQuery, mca]);

  const lookup = useCallback(
    async (refresh = false) => {
      const din = checkQuery();
      if (!din) return;
      setLoading(true);
      try {
        const res = await fetch("/api/tools/din-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ din, refresh }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? `Lookup failed (${res.status}).`);
          setResult(null);
        } else {
          setResult({ data: json.data, cached: json.cached, source: json.source ?? "falcon", fetchedAt: json.fetchedAt });
        }
      } catch {
        setError("Network error — could not reach the server.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [checkQuery],
  );

  const d = result?.data;
  const companies = d?.associations.filter((a) => a.entityType !== "llp") ?? [];
  const llps = d?.associations.filter((a) => a.entityType === "llp") ?? [];

  return (
    <PageTransition>
      <SEO title="MCA Lookup" description="Director, designated partner and company master data from MCA" path={pathname} />
      <PageHeader
        title="MCA Lookup"
        icon={IdCard}
        subtitle="Master data for directors and designated partners"
      />

      {/* The portal's search block: one box, then what the number is. */}
      <div className="mb-6 space-y-3" data-print="hide">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Enter DIN or DPIN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            className="h-11 max-w-xl flex-1 font-mono text-[15px] tracking-wide"
            maxLength={40}
            aria-label="DIN or DPIN"
          />
          <Button className="h-11 px-5" onClick={() => lookup()} disabled={loading || mca.waiting}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            Search
          </Button>
        </div>

        <RadioGroup
          value={kind}
          onValueChange={(v) => setKind(v === "company" ? "company" : "director")}
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="company" id="mca-kind-company" disabled />
            <label htmlFor="mca-kind-company" className="text-[14px] text-ink-muted">
              Company / LLP
              <span className="ml-1.5 text-[12px]">(not enabled yet)</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="director" id="mca-kind-director" />
            <label htmlFor="mca-kind-director" className="cursor-pointer text-[14px] text-ink">
              Directors / Designated partners
            </label>
          </div>
        </RadioGroup>

        <div className="flex flex-wrap items-center gap-2">
          {/* Off until the VCFO Assist extension is set up: a button that can only fail is worse
              than one that says why it cannot be pressed. */}
          <Button
            variant="outline"
            onClick={askMca}
            disabled={loading || mca.waiting || mca.setUp === false}
            title={
              mca.setUp === false
                ? 'Needs the VCFO Assist extension, which is not set up yet. Search reads the same DIN through the API instead.'
                : 'Read the report in your own signed-in MCA tab'
            }
          >
            {mca.waiting ? <Loader2 className="animate-spin" /> : <Landmark />}
            Read from MCA
          </Button>
          {mca.setUp === false && (
            <span className="text-[13px] text-ink-muted">
              Needs the VCFO Assist extension — use <strong className="font-medium text-ink">Search</strong>, which needs no MCA login.
            </span>
          )}
          {d && (
            <Button variant="ghost" onClick={() => window.print()} title="Print or save the report as a PDF">
              <Printer />
              Print
            </Button>
          )}
        </div>
      </div>

      {/* "Not set up" is not a failure, so it reads as a note; anything else is a real error. */}
      {(error || mca.error) &&
        (mca.notSetUp && !error ? (
          <div className="mb-6 rounded-md border border-line bg-surface-sunken/40 px-4 py-3 text-[14px] text-ink-muted">
            The MCA portal path needs the VCFO Assist extension, which is not set up yet. Use
            <strong className="font-medium text-ink"> Search</strong> — it reads the same DIN
            through the API and needs no MCA login.
          </div>
        ) : (
          <div className="mb-6 rounded-md border border-danger/30 bg-danger-fill/10 px-4 py-3 text-[14px] text-danger">
            {error ?? mca.error}
          </div>
        ))}

      {mca.waiting && (
        <DashSection
          title="Waiting for your MCA tab"
          meta={mca.request ? `DIN ${mca.request.din}` : undefined}
          headIcon={{ icon: Landmark, tone: "violet" }}
          right={
            <Button variant="ghost" size="sm" onClick={() => void mca.cancel()}>
              <X />
              Cancel
            </Button>
          }
        >
          <ol className="ml-4 list-decimal space-y-1 text-[13px] text-ink-muted">
            <li>Sign in to the MCA portal in another tab of this browser, with your own login.</li>
            <li>VCFO Assist reads the director report there and brings it back here.</li>
          </ol>
          <p className="mt-3 text-[13px] text-ink-muted">
            Your MCA password, OTP and captcha stay on the MCA page. The Suite never receives them
            and never signs in for you.
          </p>
        </DashSection>
      )}

      {!d && !error && !loading && !mca.waiting && (
        <EmptyState title="Enter a DIN or DPIN above to see the MCA master data." />
      )}

      {d && (
        <div className="space-y-4">
          {/* The printed copy carries its own heading, because the shell's does not print. */}
          <div className="hidden print:mb-4 print:block">
            <h2 className="text-[16px] font-semibold text-ink">Director / designated partner details</h2>
            <p className="text-[12px] text-ink-muted">
              DIN/DPIN {d.din}
              {d.name ? ` · ${d.name}` : ""} · {SOURCE_LABEL[result.source]} · read{" "}
              {new Date(result.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <ResultsRow data={d} />

          <DashSection
            title={d.name || d.din}
            meta={d.name ? `DIN/DPIN ${d.din}` : undefined}
            headIcon={{ icon: UserRound, tone: "blue" }}
            right={
              <div className="flex items-center gap-3 text-[13px] text-ink-muted" data-print="hide">
                <Chip tone={result.source === "mca-portal" ? "violet" : "teal"} raw>
                  {result.source === "mca-portal" ? "MCA portal" : "FalconeBiz"}
                </Chip>
                {result.cached && <span>Cached {formatTimeAgo(result.fetchedAt)}</span>}
                <Button variant="ghost" size="sm" onClick={() => lookup(true)} disabled={loading}>
                  <RefreshCw className={loading ? "animate-spin" : ""} />
                  Refresh
                </Button>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {d.dinStatus ? <Chip tone={dinStatusKind(d.dinStatus)} raw>{`DIN ${d.dinStatus}`}</Chip> : null}
              {d.dir3Kyc ? <Chip tone={kycKind(d.dir3Kyc)} raw>{`DIR-3 KYC ${d.dir3Kyc}`}</Chip> : null}
            </div>
            <dl className="space-y-2">
              <InfoRow label="DIN/DPIN" value={d.din} />
              <InfoRow label="Name of director / designated partner" value={d.name} />
              <InfoRow label="DIN status" value={d.dinStatus} />
              <InfoRow label="DIN approved on" value={d.approveDate} />
              <InfoRow label="DIR-3 KYC" value={d.dir3Kyc} />
              <InfoRow label="MCA data refreshed" value={d.providerUpdatedAt} />
            </dl>
          </DashSection>

          <AssociationCard title="List of associated companies" rows={companies} />
          <AssociationCard title="List of associated LLPs" rows={llps} llp />

          {d.associations.length === 0 && (
            <DashSection title="Associations" headIcon={{ icon: Building2, tone: "violet" }}>
              <p className="text-[13px] text-ink-muted">MCA holds no company or LLP against this DIN.</p>
            </DashSection>
          )}

          <DashSection title="What MCA does not publish" headIcon={{ icon: ShieldCheck, tone: "teal" }}>
            <p className="text-[13px] text-ink-muted">
              PAN, date of birth, father&apos;s name, address, phone, email and nationality are not part
              of the MCA director master data. Use this report to verify the DIN, its status and the
              appointments; the personal details a DIR-3 or SPICe+ filing needs still come from the
              client&apos;s own file.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
              <Landmark className="size-3.5" />
              Source: {SOURCE_LABEL[result.source]}. Read {new Date(result.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
            </p>
          </DashSection>
        </div>
      )}
    </PageTransition>
  );
}
