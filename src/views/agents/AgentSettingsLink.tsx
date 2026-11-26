'use client';

import Link from 'next/link';
import { DashSection } from '@/components/dash/DashSection';
import { buttonVariants } from '@/components/ui/button-variants';
import { useApp } from '@/context/AppContext';
import { roleAppSegment } from '@/lib/auth-routes';

/**
 * The way into Settings > Agents from Firm settings (admin and super admin): one line and the
 * link. The page itself is `AgentSettingsPage`.
 */
export function AgentSettingsLink() {
  const { user } = useApp();
  const href = `/app/${roleAppSegment(user?.role)}/agent-settings`;
  return (
    <DashSection title="Agents">
      <p className="text-[13px] text-ink-2">The card agents&apos; kill switch, the GSTZen and live browser routes, pilot users, limits and recipes.</p>
      <Link href={href} className={`${buttonVariants({ size: 'sm', variant: 'outline' })} mt-3`}>
        Open agent settings
      </Link>
    </DashSection>
  );
}
