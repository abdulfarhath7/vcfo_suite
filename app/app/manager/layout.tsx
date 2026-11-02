import { ConsoleGate } from '@/components/console/ConsoleRoot';
import { PORTAL_FONT_VARS } from '@/components/portal/fonts';

/** The manager portal: the staff console (Graphite) for the manager seat. */
export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleGate seat="mgr" fontVars={PORTAL_FONT_VARS}>
      {children}
    </ConsoleGate>
  );
}
