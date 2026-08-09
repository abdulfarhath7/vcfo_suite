import EngagementDetailClient from '@/views/admin/EngagementDetailClient';

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Engagement", "Engagement detail");


export default function InternEngagementPage() {
  return <EngagementDetailClient />;
}
