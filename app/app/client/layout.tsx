import { ClientPortalGate } from "@/components/client-portal/ClientPortalGate";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientPortalGate>{children}</ClientPortalGate>;
}
