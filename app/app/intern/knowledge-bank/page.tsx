import KnowledgeBankPage from "@/views/knowledge-bank/KnowledgeBankPage";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Knowledge bank", "Internal knowledge base");


export default function Page() {
  return <KnowledgeBankPage basePath="/app/intern/knowledge-bank" />;
}
