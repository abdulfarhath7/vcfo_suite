import { AppShell } from "@/components/shell/AppShell";

export default function FirmAdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requireRole="admin">{children}</AppShell>;
}
