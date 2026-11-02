import DevAccess from '@/views/dev/DevAccess';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Access', 'Staff sign-in, two-step and sessions');

export default function Page() {
  return <DevAccess />;
}
