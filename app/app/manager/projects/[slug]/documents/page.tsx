import DocPackViewClient from '@/views/engagement/DocPackViewClient';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Pre-incorporation documents', 'Generated document pack');

export default function Page() {
  return <DocPackViewClient />;
}
