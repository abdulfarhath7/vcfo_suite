import { pageMetadata } from "@/lib/page-metadata";
import AuditLog from "@/views/admin/AuditLog";

export const metadata = pageMetadata("Audit log", "Firm audit trail");

export default function Page() {
  return <AuditLog />;
}
