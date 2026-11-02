import { RegulatoryPage } from '@/components/console/pages/updates/RegulatoryPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Regulatory updates", "Official updates waiting for your review");

export default function Page() {
  return <RegulatoryPage />;
}
