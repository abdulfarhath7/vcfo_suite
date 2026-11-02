import { NewProjectPage } from '@/components/console/pages/clients/NewProjectPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("New project", "Set up a new client project");

export default function Page() {
  return <NewProjectPage />;
}
