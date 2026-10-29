import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Doc vault', 'Firm document vault');

/** The Vault itself renders from `layout.tsx`, so the viewer route can keep it mounted. */
export default function Page() {
  return null;
}
