import { Suspense } from "react";
import { ComplianceCalendarPage } from "@/views/compliances/CompliancePages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Calendar", "Compliance calendar");

/** Route shell only. The shared view is identical in every shell; `AuthContext` decides the rows. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>}>
      <ComplianceCalendarPage basePath="/app/intern/compliances" />
    </Suspense>
  );
}
