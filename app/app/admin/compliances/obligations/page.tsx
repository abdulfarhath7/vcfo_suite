import { Suspense } from "react";
import { ObligationsPage } from "@/views/compliances/CompliancePages";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Obligations", "Statutory obligations grouped by filing");

/** Route shell only. `?company=` / `?by=` / `?state=` carry the state on refresh; `AuthContext` decides the rows. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading obligations…</div>}>
      <ObligationsPage basePath="/app/admin/compliances" />
    </Suspense>
  );
}
