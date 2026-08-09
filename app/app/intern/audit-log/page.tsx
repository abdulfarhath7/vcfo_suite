import { pageMetadata } from "@/lib/page-metadata";
import AuditLog from "@/views/admin/AuditLog";

export const metadata = pageMetadata("Audit log", "Lead audit trail");

export default function Page() {
  return <AuditLog />;
}
