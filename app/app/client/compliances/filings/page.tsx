import { Suspense } from "react";
import { ClientFilingsPage } from "@/views/client/ClientCompliancePages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Filings", "Statutory filing register");

/** Client shell. `?cadence=` / `?period=` / `?fy=` carry the state on refresh. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading filings…</div>}>
      <ClientFilingsPage />
    </Suspense>
  );
}
