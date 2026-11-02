import { ClientRoute } from '@/components/portal/Intent';
import { LegacyLibrary } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Library", "Books and explanations you saved from Ask VCFO");

/** Scrolls to Library. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'library' }} legacy={<LegacyLibrary />} />;
}
