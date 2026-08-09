import { pageMetadata } from "@/lib/page-metadata";
import KnowledgeBankPage from "@/views/knowledge-bank/KnowledgeBankPage";

export const metadata = pageMetadata("Knowledge Bank", "Templates and reference docs");

export default function Page() {
  return <KnowledgeBankPage basePath="/app/admin/knowledge-bank" />;
}
