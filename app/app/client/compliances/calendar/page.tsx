import { Suspense } from "react";
import { ClientCompliancesCalendarRoute } from "@/components/client-portal/pages/compliances";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Calendar", "Compliance calendar");

/** Client portal v7 calendar (?date= ?view= ?area= ?filing= carry the state on refresh). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientCompliancesCalendarRoute />
    </Suspense>
  );
}
