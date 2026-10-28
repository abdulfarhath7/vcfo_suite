import { Suspense } from "react";
import { ObligationPage } from "@/views/compliances/CompliancePages";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Obligation", "One statutory obligation across your clients");

/** Route shell only. `id` is the obligation id; `?company=` narrows to one client. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading obligation…</div>}>
      <ObligationPage basePath="/app/admin/compliances" obligationId={decodeURIComponent(id)} />
    </Suspense>
  );
}
