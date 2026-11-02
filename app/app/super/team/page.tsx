import SuperTeam from '@/views/super/SuperTeam';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Team', 'Managers, their project leads and the load on each');

export default function Page() {
  return <SuperTeam />;
}
