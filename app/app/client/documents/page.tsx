import ClientDocuments from "@/views/client/Documents";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Documents", "Your documents");


export default function Page() {
  return <ClientDocuments />;
}
