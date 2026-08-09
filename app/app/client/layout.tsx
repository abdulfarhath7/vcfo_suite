import { AppShell } from "@/components/shell/AppShell";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requireRole="client">{children}</AppShell>;
}
