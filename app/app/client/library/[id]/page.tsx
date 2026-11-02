import { ClientRoute } from '@/components/portal/Intent';
import { LegacyLibrary } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Library", "A saved explanation");

/** Opens a saved Ask VCFO answer in the Library reader. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return <ClientRoute intent={{ kind: 'reader', mode: 'saved', id: decodeURIComponent(p.id) }} legacy={<LegacyLibrary />} />;
}
