import AccountSettings from '@/views/settings/AccountSettings';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Profile', 'Your profile and settings');

/* Super admin profile (prototype /super/profile): its own page, with `?tab=` picking the section.
   Settings › Your profile keeps working as before. */
export default function Page() {
  return <AccountSettings path="/app/super/profile" />;
}
