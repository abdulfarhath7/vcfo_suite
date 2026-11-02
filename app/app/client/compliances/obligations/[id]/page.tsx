import { Suspense } from "react";
import { ClientCompliancesObligationRoute } from "@/components/client-portal/pages/compliances";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Obligation", "One statutory obligation and its periods");

/** Client portal obligation record (?filing=<id> opens that period's side panel). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientCompliancesObligationRoute />
    </Suspense>
  );
}
