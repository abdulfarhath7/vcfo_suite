import { TaskDetailView } from '@/views/compliances/TaskDetailView';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Task', 'One non-statutory task: checklist, files, comments and reminders');

/** Route shell only. `id` is the task id; the task route scopes it by `AuthContext`. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailView basePath="/app/intern/compliances" taskId={decodeURIComponent(id)} />;
}
