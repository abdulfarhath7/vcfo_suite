import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Document', 'Document viewer');

/** The viewer overlay is drawn by the vault layout from the path; this page only claims the route. */
export default function Page() {
  return null;
}
