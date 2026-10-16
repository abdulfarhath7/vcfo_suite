import { CredentialsPage } from '@/components/client-portal/pages/credentials/CredentialsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Credentials', 'Government portal logins, registrations and directors’ KYC');

export default function Page() {
  return <CredentialsPage />;
}
