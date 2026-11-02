import { ClientRoute } from '@/components/portal/Intent';
import ClientTeamPage from '@/views/client/ClientTeam';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Team", "Your SBC team and the people from your company");

/** Scrolls to Team. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'team' }} legacy={<ClientTeamPage />} />;
}
