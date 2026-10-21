import { ReaderPage } from "@/components/client-portal/pages/documents/library/Reader";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Learn", "An explanation from Ask VCFO");

export default function Page() {
  return <ReaderPage mode="learn" />;
}
