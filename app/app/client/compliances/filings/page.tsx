import { Suspense } from "react";
import { ClientCompliancesFilingsRoute } from "@/components/client-portal/pages/compliances";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Filings", "Statutory filing register");

/** Client portal v7 filings (?fy= ?cadence= ?area= ?status= ?period= ?view=year ?filing=). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientCompliancesFilingsRoute />
    </Suspense>
  );
}
