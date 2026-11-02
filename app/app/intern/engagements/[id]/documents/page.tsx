import { EngagementRedirect } from '@/components/console/pages/clients/EngagementRedirect';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Client', 'Opening the client');

/** Old lead link: lands on /app/intern/projects/<slug>/… with the query string kept. */
export default function Page() {
  return <EngagementRedirect to="documents" />;
}
