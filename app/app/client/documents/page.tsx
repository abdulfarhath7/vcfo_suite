import { ClientRoute } from '@/components/portal/Intent';
import { LegacyDocuments } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Documents", "Your documents");

/** Scrolls to Documents. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'documents' }} legacy={<LegacyDocuments />} />;
}
