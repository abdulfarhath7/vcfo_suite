import AskSources from "@/views/admin/ask/AskSources";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Ask VCFO sources", "Knowledge sources for Ask VCFO");

export default function Page() {
  return <AskSources />;
}
