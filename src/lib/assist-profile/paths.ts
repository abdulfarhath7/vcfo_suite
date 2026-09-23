/** Client-safe URL of the Assist profile route. */
export function assistProfileApiPath(engagementId: string): string {
  return `/api/engagements/${encodeURIComponent(engagementId)}/assist-profile`;
}

/** Steps that show the "Copy for Assist" control: Name Application and SPICe+ Filing. */
export const ASSIST_PROFILE_STEP_IDS: ReadonlySet<string> = new Set(['pre-4', 'pre-10']);
