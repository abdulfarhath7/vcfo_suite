import AdminAnalytics from "@/views/admin/Analytics";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Analytics", "Firm analytics");


export default function Page() {
  return <AdminAnalytics />;
}
