import { pageMetadata } from "@/lib/page-metadata";
import ApprovalsInbox from "@/views/admin/ApprovalsInbox";

export const metadata = pageMetadata("Approvals", "Firm-wide pending reviews");

export default function Page() {
  return <ApprovalsInbox scope="firm" />;
}
