import KnowledgeReader from '@/views/knowledge-bank/KnowledgeReader';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Knowledge bank', 'A knowledge bank file');

/** Staff knowledge reader (prototype ReaderScreen): one knowledge bank file with its preview. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnowledgeReader basePath="/app/manager/knowledge-bank" id={id} />;
}
