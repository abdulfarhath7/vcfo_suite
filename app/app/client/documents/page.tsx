import { DocumentsPage } from "@/components/client-portal/pages/documents/DocumentsPage";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Documents", "Your documents");

export default function Page() {
  return <DocumentsPage />;
}
