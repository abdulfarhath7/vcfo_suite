import { Suspense } from "react";
import { FilingsPage } from "@/views/compliances/CompliancePages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Filings", "Statutory filing register");

/** Route shell only. `?company=` / `?status=` / `?cadence=` / `?period=` / `?fy=` carry the state on refresh. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading filings…</div>}>
      <FilingsPage basePath="/app/admin/compliances" />
    </Suspense>
  );
}
