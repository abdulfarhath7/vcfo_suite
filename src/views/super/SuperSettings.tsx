'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import AccountSettings from '@/views/settings/AccountSettings';
import { FirmSettingsBody } from '@/views/firm-settings/FirmSettings';

/**
 * SUPER ADMIN SETTINGS — the sidebar's "Firm settings" and the account row both land here
 * (`roleSettingsPath('super_admin')`). Two tabs: Firm (the firm settings store, G-02) and
 * Your profile (the existing `AccountSettings`, kept whole).
 *
 * The profile tab opens by itself for `?tab=profile`, the Outlook connect return (`?outlook=`)
 * and the profile section hashes (`#appearance` from the greeting card, and the others), so
 * every link that used to reach the profile still does.
 */
type TabKey = 'firm' | 'profile';

const PROFILE_HASHES = new Set(['profile', 'security', 'email', 'appearance']);
const PATH = '/app/super/settings';

function SuperSettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromQuery: TabKey | null =
    params.get('tab') === 'profile' || params.has('outlook') ? 'profile' : params.get('tab') === 'firm' ? 'firm' : null;
  const [tab, setTab] = useState<TabKey>(fromQuery ?? 'firm');

  // The hash only exists in the browser, so it is read after mount.
  useEffect(() => {
    if (fromQuery) return;
    const hash = window.location.hash.replace('#', '');
    if (PROFILE_HASHES.has(hash)) setTab('profile');
  }, [fromQuery]);

  const pick = (key: string) => {
    const next = key === 'profile' ? 'profile' : 'firm';
    setTab(next);
    router.replace(next === 'profile' ? `${pathname}?tab=profile` : pathname, { scroll: false });
  };

  const tabs = (
    <SpectrumTabs
      variant="underline"
      label="Settings"
      items={[
        { key: 'firm', label: 'Firm' },
        { key: 'profile', label: 'Your profile' },
      ]}
      value={tab}
      onChange={pick}
    />
  );

  if (tab === 'profile') {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <AccountSettings path={PATH} />
      </div>
    );
  }

  return (
    <PageTransition>
      <SEO title="Firm settings — VCFO Suite" description="The firm's profile, calendar, branding and reminders." path={PATH} />
      <div className="flex flex-col gap-4">
        <h1 className="text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink">Firm settings</h1>
        {tabs}
        <FirmSettingsBody />
      </div>
    </PageTransition>
  );
}

export default function SuperSettings() {
  return (
    <Suspense fallback={null}>
      <SuperSettingsInner />
    </Suspense>
  );
}
