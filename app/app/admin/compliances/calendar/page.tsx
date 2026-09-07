import { Suspense } from "react";
import { StaffComplianceCalendarPage } from "@/views/compliances/StaffCompliancePages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Calendar", "Compliance calendar");

/**
 * Staff shell. The shared view renders in firm scope — `AuthContext` decides
 * the rows; the wrapper hands it the scoped roster and the pre-COI ids.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>}>
      <StaffComplianceCalendarPage basePath="/app/admin/compliances" />
    </Suspense>
  );
}
