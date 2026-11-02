import { RegistrationsPage } from '@/components/console/pages/lead/RegistrationsPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Registrations', 'Registrations across your clients');

/** The console's Registrations page (shared with the project lead); the Today model scopes it to the manager's book. */
export default function Page() {
  return <RegistrationsPage />;
}
