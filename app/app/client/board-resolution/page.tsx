import { ClientRoute } from '@/components/portal/Intent';
import { LegacyBoard } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Board resolution", "Board resolution documents");

/** Opens the board resolution (Incorporation, or Declarations for a new client). */
export default function Page() {
  return <ClientRoute intent={{ kind: 'board' }} legacy={<LegacyBoard />} />;
}
