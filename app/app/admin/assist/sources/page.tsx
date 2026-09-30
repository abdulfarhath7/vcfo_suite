import AssistSources from "@/views/admin/assist/AssistSources";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Assist sources", "Knowledge sources for Assist");

export default function Page() {
  return <AssistSources />;
}
