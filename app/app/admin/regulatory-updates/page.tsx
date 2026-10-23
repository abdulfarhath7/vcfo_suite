import RegulatoryUpdates from '@/views/manager/RegulatoryUpdates';

import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Regulatory updates', 'Official updates and their manager review');

export default function Page() {
  return <RegulatoryUpdates basePath="/app/admin" />;
}
