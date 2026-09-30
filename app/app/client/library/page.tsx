import ClientLibrary from "@/views/client/ask/ClientLibrary";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Library", "Explanations you saved from Ask VCFO");

export default function Page() {
  return <ClientLibrary />;
}
