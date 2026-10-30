import { Suspense } from "react";
import { ClientCompliancesTaskRoute } from "@/components/client-portal/pages/compliances";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Task", "One non-statutory task shared with the client");

/** Client portal non-statutory task page (COMPLIANCE-MODEL.md 4.3; a firm-only task reads as not shared). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientCompliancesTaskRoute />
    </Suspense>
  );
}
