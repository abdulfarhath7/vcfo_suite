import ClientLibraryItem from "@/views/client/assist/ClientLibraryItem";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Library", "A saved explanation");

export default function Page() {
  return <ClientLibraryItem />;
}
