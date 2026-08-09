import InternRequests from "@/views/intern/Requests";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Requests", "Document requests");


export default function Page() {
  return <InternRequests />;
}
