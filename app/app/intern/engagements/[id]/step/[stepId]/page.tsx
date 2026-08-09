import EngagementStepDetailClient from "@/views/engagement/EngagementStepDetailClient";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Step", "Checklist step detail");


export default function Page() {
  return <EngagementStepDetailClient />;
}
