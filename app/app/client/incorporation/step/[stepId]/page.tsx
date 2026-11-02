import { ClientRoute } from '@/components/portal/Intent';
import { LegacyStep } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Step", "Checklist step");

/** Opens a step (id like pre-13, or its slug) in its walkthrough — the link every step email carries. */
export default async function Page({ params }: { params: Promise<{ stepId: string }> }) {
  const p = await params;
  return <ClientRoute intent={{ kind: 'step', stepId: decodeURIComponent(p.stepId) }} legacy={<LegacyStep />} />;
}
