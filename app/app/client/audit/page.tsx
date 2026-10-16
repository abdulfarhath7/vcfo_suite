import AuditLog from "@/views/admin/AuditLog";
import { ClientAuditEntry } from "@/components/client-portal/pages/team";

export default function ClientAuditPage() {
  return <ClientAuditEntry legacy={<AuditLog />} />;
}
