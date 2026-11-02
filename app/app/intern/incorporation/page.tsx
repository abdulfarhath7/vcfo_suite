import { IncorporationPage } from '@/components/console/pages/clients/IncorporationPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Incorporation', 'Clients in incorporation: current step, progress, who holds it and status');

export default function Page() {
  return <IncorporationPage />;
}
