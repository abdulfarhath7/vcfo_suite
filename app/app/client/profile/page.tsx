import AccountSettings from '@/views/settings/AccountSettings';
import { ClientSettingsEntry } from '@/components/client-portal/pages/team';

/** The client Profile page (prototype `/client/profile`); `/app/client/settings` shows the same page. */
export default function Page() {
  return <ClientSettingsEntry legacy={<AccountSettings path="/app/client/settings" />} />;
}
