import InternMyWork from "@/views/intern/MyWork";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("My work", "List, board, and timeline of your open steps and filings");

export default function Page() {
  return <InternMyWork />;
}
