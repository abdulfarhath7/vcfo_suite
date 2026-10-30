import { AskFullPage } from '@/components/ask/AskFullPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Ask VCFO', 'Ask VCFO, full page');

export default function Page() {
  return <AskFullPage />;
}
