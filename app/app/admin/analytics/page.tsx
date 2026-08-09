import { pageMetadata } from "@/lib/page-metadata";
import Analytics from "@/views/admin/Analytics";

export const metadata = pageMetadata("Analytics", "Firm analytics");

export default function Page() {
  return <Analytics />;
}
