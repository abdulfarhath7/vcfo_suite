import { ClientRoute } from '@/components/portal/Intent';
import { LegacyLibrary } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Learn", "An explanation from Ask VCFO");

/** Opens an Ask VCFO explanation in the Library reader. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params;
  return <ClientRoute intent={{ kind: 'reader', mode: 'learn', id: decodeURIComponent(p.slug) }} legacy={<LegacyLibrary />} />;
}
