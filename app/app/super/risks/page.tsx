import SuperRisks from '@/views/super/SuperRisks';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Risks', 'Overdue steps, overdue filings and stuck clients');

export default function Page() {
  return <SuperRisks />;
}
