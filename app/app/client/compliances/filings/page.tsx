import { Suspense } from "react";
import { FilingsView } from "@/views/compliances/FilingsView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Filings", "Statutory filing register");

/** Client shell. `?cadence=` / `?period=` / `?fy=` carry the state on refresh. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading filings…</div>}>
      <FilingsView basePath="/app/client/compliances" />
    </Suspense>
  );
}
