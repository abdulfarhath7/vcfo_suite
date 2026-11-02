import { RegistrationsPage } from '@/components/console/pages/lead/RegistrationsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Registrations", "Registrations across your clients");

export default function Page() {
  return <RegistrationsPage />;
}
