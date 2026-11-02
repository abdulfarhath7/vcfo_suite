import { TeamLoadPage } from '@/components/console/pages/leads/TeamLoadPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Team load", "Your project leads side by side");

export default function Page() {
  return <TeamLoadPage />;
}
