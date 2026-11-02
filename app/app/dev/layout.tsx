import { AppShell } from '@/components/shell/AppShell';

/** Developer console (G-01): the staff shell for a developer; the super admin may also enter. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <AppShell requireRole="developer">{children}</AppShell>;
}
