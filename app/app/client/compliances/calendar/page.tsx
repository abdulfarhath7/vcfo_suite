import { Suspense } from "react";
import { ComplianceCalendarView } from "@/views/compliances/ComplianceCalendarView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Calendar", "Compliance calendar");

/** Client shell. The view is scope-parameterized — `AuthContext` decides the rows. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>}>
      <ComplianceCalendarView basePath="/app/client/compliances" />
    </Suspense>
  );
}
