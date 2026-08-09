import InternClients from "@/views/intern/Clients";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Clients", "Assigned clients");


export default function Page() {
  return <InternClients />;
}
