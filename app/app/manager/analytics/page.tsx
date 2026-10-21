import AdminAnalytics from "@/views/admin/Analytics";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Analytics", "Firm analytics");


export default function Page() {
  return <AdminAnalytics />;
}
