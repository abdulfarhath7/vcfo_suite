import EngagementStepDetailClient from "@/views/engagement/EngagementStepDetailClient";

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Step", "Checklist step");

/**
 * The client opens the SAME step workspace the project lead does — one
 * component, not a lookalike. The client has a single engagement, so this route
 * carries only `{stepId}`; `EngagementStepDetail` resolves the engagement from
 * the signed-in client and runs the gate with the `client` viewer, which is what
 * strips the staff-only controls.
 */
export default function Page() {
  return <EngagementStepDetailClient />;
}
