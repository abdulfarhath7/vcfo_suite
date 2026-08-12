import { AppShell } from "@/components/shell/AppShell";

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requireRole="super_admin">{children}</AppShell>;
}
