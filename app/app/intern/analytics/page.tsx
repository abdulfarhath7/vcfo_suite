import { pageMetadata } from "@/lib/page-metadata";
import Analytics from "@/views/admin/Analytics";

export const metadata = pageMetadata("Analytics", "Lead analytics");

export default function Page() {
  return <Analytics />;
}
