import { KnowledgeFileOpen } from '@/components/console/pages/workspace/KnowledgeFileOpen';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Knowledge bank', 'A knowledge bank file');

/** One knowledge bank file: opens its preview over the library, in the file's folder. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnowledgeFileOpen id={id} />;
}
