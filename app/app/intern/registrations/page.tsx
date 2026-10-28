import { Suspense } from "react";
import { RegistrationsPage } from "@/views/compliances/CompliancePages";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Registrations", "Statutory registrations across your clients");

/** Route shell only. `?company=` / `?view=grid` / `?state=` carry the state on refresh; the scoped roster decides the rows. */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading registrations…</div>}>
      <RegistrationsPage shellBase="/app/intern" />
    </Suspense>
  );
}
