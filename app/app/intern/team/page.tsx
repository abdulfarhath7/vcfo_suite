import { LeadTeamPage } from '@/components/console/pages/lead/LeadTeamPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Team", "The people on your clients");

export default function Page() {
  return <LeadTeamPage />;
}
