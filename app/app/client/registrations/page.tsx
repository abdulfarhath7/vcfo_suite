import { Suspense } from "react";
import { ClientRegistrationsRoute } from "@/components/client-portal/pages/registrations";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Registrations", "Registrations of the company");

/** Client portal registrations: the registration phase of the checklist with the stored numbers. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientRegistrationsRoute />
    </Suspense>
  );
}
