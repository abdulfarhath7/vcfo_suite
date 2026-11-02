import { ClientStepPage } from '@/components/console/pages/clients/ClientStepPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Step", "One checklist step");

export default function Page() {
  return <ClientStepPage />;
}
