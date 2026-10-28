import { Suspense } from "react";
import { RegistrationPage } from "@/views/compliances/CompliancePages";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Registration", "One registration for one client");

/** Route shell only. `id` is `{engagementId}~{stepId}`. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading registration…</div>}>
      <RegistrationPage shellBase="/app/admin" recordKey={decodeURIComponent(id)} />
    </Suspense>
  );
}
