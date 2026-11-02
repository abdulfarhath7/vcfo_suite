import { ConsoleGate } from '@/components/console/ConsoleRoot';
import { PORTAL_FONT_VARS } from '@/components/portal/fonts';

/** The project lead's portal: the staff console (Graphite) for the lead seat. */
export default function InternLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleGate seat="lead" fontVars={PORTAL_FONT_VARS}>
      {children}
    </ConsoleGate>
  );
}
