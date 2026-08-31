import { Suspense } from "react";
import ClientIncorporation from "@/views/client/Incorporation";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Incorporation", "Incorporation checklist");


export default function Page() {
  // The wizard reads `?step=` from a "please fill this" email link.
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-muted-foreground">Loading checklist…</div>}
    >
      <ClientIncorporation />
    </Suspense>
  );
}
