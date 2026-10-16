import AccountSettings from '@/views/settings/AccountSettings';
import { ClientSettingsEntry } from '@/components/client-portal/pages/team';

export default function Page() {
  return <ClientSettingsEntry legacy={<AccountSettings path="/app/client/settings" />} />;
}
