import { ClientGate } from '@/components/portal/ClientGate';
import { PORTAL_FONT_VARS } from '@/components/portal/fonts';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientGate fontVars={PORTAL_FONT_VARS}>{children}</ClientGate>;
}
