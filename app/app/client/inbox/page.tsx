import ClientInbox from "@/views/client/Inbox";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Inbox", "Client inbox");


export default function Page() {
  return <ClientInbox />;
}
