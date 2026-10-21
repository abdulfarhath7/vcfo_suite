import { pageMetadata } from "@/lib/shell/page-metadata";
import ApprovalsInbox from "@/views/admin/ApprovalsInbox";

export const metadata = pageMetadata("Approvals", "Firm-wide pending reviews");

export default function Page() {
  return <ApprovalsInbox scope="firm" />;
}
