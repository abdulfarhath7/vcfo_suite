import LeadPage from "@/views/manager/LeadPage";

import { pageMetadata } from "@/lib/shell/page-metadata";

export const metadata = pageMetadata("Project lead", "One project lead's work, status and planner");

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadPage leadKey={decodeURIComponent(leadId)} />;
}
