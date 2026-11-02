import { FilingsPage } from '@/components/console/pages/compliance/FilingsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Filings register", "Statutory filing register across your book");

export default function Page() {
  return <FilingsPage />;
}
