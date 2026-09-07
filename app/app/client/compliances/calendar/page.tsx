import { Suspense } from "react";
import { ClientComplianceCalendarPage } from "@/views/client/ClientCompliancePages";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Calendar", "Compliance calendar");

/**
 * Client shell. The view is scope-parameterized — `AuthContext` decides the
 * rows; the wrapper derives the pre-incorporation state for the client's own
 * engagement.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>}>
      <ClientComplianceCalendarPage />
    </Suspense>
  );
}
