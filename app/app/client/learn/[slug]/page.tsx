import ClientLearnTopic from "@/views/client/assist/ClientLearnTopic";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Learn", "An explanation from Assist");

export default function Page() {
  return <ClientLearnTopic />;
}
