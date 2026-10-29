import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Vault', 'Document vault');

/** The Vault itself renders from `layout.tsx`, so the viewer route can keep it mounted. */
export default function Page() {
  return null;
}
