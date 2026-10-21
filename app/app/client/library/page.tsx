import { LibraryPage } from "@/components/client-portal/pages/documents/library/LibraryPage";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Library", "Explanations you saved from Ask VCFO");

export default function Page() {
  return <LibraryPage />;
}
