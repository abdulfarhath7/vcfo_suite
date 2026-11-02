import { Suspense } from "react";
import { ClientRegistrationRoute } from "@/components/client-portal/pages/registrations";
import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Registration", "One registration of the company");

/** Client portal registration record (the id is the checklist step slug). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientRegistrationRoute />
    </Suspense>
  );
}
