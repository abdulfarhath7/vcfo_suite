import { pageMetadata } from '@/lib/shell/page-metadata';
import AgentSettingsPage from '@/views/agents/AgentSettingsPage';

export const metadata = pageMetadata('Agent settings', 'The card agents’ kill switch, routes, limits and recipes');

export default function Page() {
  return <AgentSettingsPage path="/app/admin/agent-settings" />;
}
