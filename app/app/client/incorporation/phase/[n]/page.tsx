import { PhaseRoute } from '@/components/client-portal/pages/incorporation';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Phase', 'Incorporation phase');

/** Client portal v7 phase page (prototype phase.html#p=1..4). `[n]` = 1–4 or a phase key. */
export default function Page() {
  return <PhaseRoute />;
}
