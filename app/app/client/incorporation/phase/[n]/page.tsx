import { ClientRoute } from '@/components/portal/Intent';
import { LegacyIncorporation } from '@/components/portal/legacy';

const PHASE_KEYS: Record<string, number> = { 'pre-inc-phase-1': 1, 'pre-inc-phase-2': 2, 'post-inc-phase-3': 3, 'registration-phase-4': 4, 'part-a': 1, 'part-b': 2, 'post-incorporation': 3, registration: 4 };
function phaseNo(raw: string): number {
  const n = PHASE_KEYS[raw] ?? Number.parseInt(raw, 10);
  return n >= 1 && n <= 4 ? n : 1;
}
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Phase", "Incorporation phase");

/** Opens one incorporation phase (1–4 or a phase key) in its walkthrough. */
export default async function Page({ params }: { params: Promise<{ n: string }> }) {
  const p = await params;
  return <ClientRoute intent={{ kind: 'phase', phaseNo: phaseNo(p.n) }} legacy={<LegacyIncorporation />} />;
}
