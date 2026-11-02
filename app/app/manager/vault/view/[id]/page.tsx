import { VaultFileOpen } from '@/components/console/pages/workspace/VaultFileOpen';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Document', 'Document viewer');

/** One vault document: opens its preview over the vault, on the file's client. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let docId = id;
  try {
    docId = decodeURIComponent(id);
  } catch {
    /* keep the raw segment */
  }
  return <VaultFileOpen id={docId} />;
}
