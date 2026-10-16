import { ReaderPage } from "@/components/client-portal/pages/documents/library/Reader";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Library", "A saved explanation");

export default function Page() {
  return <ReaderPage mode="saved" />;
}
