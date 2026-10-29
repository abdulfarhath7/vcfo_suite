import DevDeploys from '@/views/dev/DevDeploys';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Deploys', 'App Runner service state and deploy history');

export default function Page() {
  return <DevDeploys />;
}
