import { pageMetadata } from '@/lib/shell/page-metadata';
import AssistRunsPage from '@/views/assist/AssistRunsPage';

export const metadata = pageMetadata('Agent runs', 'Card agent runs on both routes and the recipe fixes waiting for review');

export default function Page() {
  return <AssistRunsPage />;
}
