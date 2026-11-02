import { ClientRoute } from '@/components/portal/Intent';
import AccountSettings from '@/views/settings/AccountSettings';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Settings", "Your account, notifications and appearance");

/** Scrolls to Settings. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'settings' }} legacy={<AccountSettings path="/app/client/settings" />} />;
}
