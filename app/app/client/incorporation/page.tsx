import ClientIncorporation from "@/views/client/Incorporation";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Incorporation", "Incorporation checklist");


export default function Page() {
  return <ClientIncorporation />;
}
