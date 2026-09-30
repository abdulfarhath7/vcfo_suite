import ClientLearnTopic from "@/views/client/ask/ClientLearnTopic";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Learn", "An explanation from Ask VCFO");

export default function Page() {
  return <ClientLearnTopic />;
}
