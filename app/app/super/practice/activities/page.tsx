import { ActivityMasterView } from '@/views/compliances/ActivityMasterView';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Activity master', 'The compliance activity master');

/** X-23: the activity master edit screen for the super admin (Practice). */
export default function Page() {
  return <ActivityMasterView basePath="/app/super/practice" />;
}
