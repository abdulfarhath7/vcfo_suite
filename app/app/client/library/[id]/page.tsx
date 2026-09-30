import ClientLibraryItem from "@/views/client/ask/ClientLibraryItem";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Library", "A saved explanation");

export default function Page() {
  return <ClientLibraryItem />;
}
