import { Suspense } from "react";
import { ClientCompliancesObligationsRoute } from "@/components/client-portal/pages/compliances";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Obligations", "Statutory obligations grouped by filing");

/** Client portal obligations: the register grouped by filing. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientCompliancesObligationsRoute />
    </Suspense>
  );
}
