import { StatDetailView } from '@/views/compliances/StatDetailView';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Filing', 'One client period of a statutory obligation');

/** Route shell only. `id` is the obligation id, `instanceId` the period; the route scopes it by `AuthContext`. */
export default async function Page({ params }: { params: Promise<{ id: string; instanceId: string }> }) {
  const { id, instanceId } = await params;
  return <StatDetailView basePath="/app/manager/compliances" obligationId={decodeURIComponent(id)} instanceId={decodeURIComponent(instanceId)} />;
}
