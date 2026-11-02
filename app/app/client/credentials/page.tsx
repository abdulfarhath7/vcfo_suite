import { ClientRoute } from '@/components/portal/Intent';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Credentials", "Government portal logins, registrations and directors’ KYC");

/** Scrolls to Credentials. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'credentials' }} />;
}
