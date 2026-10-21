/**
 * Firm display name for trust badges and exported briefs. The logo files
 * carry the same brand; `FIRM_DISPLAY_NAME` lets a deployment rename it
 * without a code change.
 */
export const DEFAULT_FIRM_NAME = 'SBC';

export function firmDisplayName(): string {
  return process.env.NEXT_PUBLIC_FIRM_DISPLAY_NAME?.trim() || DEFAULT_FIRM_NAME;
}
