import ClientLibrary from "@/views/client/assist/ClientLibrary";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Library", "Explanations you saved from Assist");

export default function Page() {
  return <ClientLibrary />;
}
