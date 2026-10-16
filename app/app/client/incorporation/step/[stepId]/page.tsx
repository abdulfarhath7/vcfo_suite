import { StepRoute } from '@/components/client-portal/pages/incorporation';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Step', 'Checklist step');

/**
 * Client portal v7 step page (live layout). Outside the portal (a super admin
 * on the staff shell) the shared `EngagementStepDetail` still renders.
 */
export default function Page() {
  return <StepRoute />;
}
