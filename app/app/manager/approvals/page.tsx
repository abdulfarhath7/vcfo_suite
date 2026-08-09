import { pageMetadata } from "@/lib/page-metadata";
import ApprovalsInbox from "@/views/admin/ApprovalsInbox";

export const metadata = pageMetadata("Approvals", "Pending reviews for your projects");

export default function Page() {
  return <ApprovalsInbox scope="manager" />;
}
