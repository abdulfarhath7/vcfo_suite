import { pageMetadata } from '@/lib/shell/page-metadata';
import AgentResultsPage from '@/views/agents/AgentResultsPage';

export const metadata = pageMetadata('Agent results', 'What the card agents filed and the time they saved');

export default function Page() {
  return <AgentResultsPage path="/app/admin/agent-results" />;
}
