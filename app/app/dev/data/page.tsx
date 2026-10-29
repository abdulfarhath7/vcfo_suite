import DevData from '@/views/dev/DevData';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Data and costs', 'Table sizes and AWS spend by service');

export default function Page() {
  return <DevData />;
}
