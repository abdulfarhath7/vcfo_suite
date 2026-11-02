import { ProjectEditPage } from '@/components/console/pages/clients/ProjectEditPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Edit project", "Project details, team and schedule");

export default function Page() {
  return <ProjectEditPage />;
}
