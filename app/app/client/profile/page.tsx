import { ClientRoute } from '@/components/portal/Intent';
import AccountSettings from '@/views/settings/AccountSettings';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Profile', 'Your profile and settings');

/** Profile = the portal's Settings section; a super admin preview gets the account settings page. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'settings' }} legacy={<AccountSettings path="/app/client/settings" />} />;
}
