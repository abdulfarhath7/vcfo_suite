import { AppShell } from "@/components/shell/AppShell";

export default function InternLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requireRole="intern">{children}</AppShell>;
}
