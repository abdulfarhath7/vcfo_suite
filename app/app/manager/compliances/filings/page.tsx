import { Suspense } from "react";
import { StaffFilingsPage } from "@/views/compliances/StaffCompliancePages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Filings", "Statutory filing register");

/** Staff shell. `?company=` / `?status=` / `?cadence=` / `?period=` / `?fy=` carry the state on refresh. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading filings…</div>}>
      <StaffFilingsPage basePath="/app/manager/compliances" />
    </Suspense>
  );
}
