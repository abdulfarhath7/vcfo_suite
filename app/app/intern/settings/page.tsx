import { SettingsPage } from '@/components/console/pages/insight/SettingsPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Settings", "Your profile, security and mailbox");

export default function Page() {
  return <SettingsPage />;
}
