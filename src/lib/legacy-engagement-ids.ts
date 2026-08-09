/** Stable UUIDs for seeded demo rows — keeps local task keys (e1-*, etc.) working. */
export const LEGACY_ENGAGEMENT_IDS: Record<string, string> = {
  '11111111-1111-1111-1111-111111111101': 'e1',
  '11111111-1111-1111-1111-111111111102': 'e2',
  '11111111-1111-1111-1111-111111111103': 'e3',
};

export const APP_ID_TO_DB_ID: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ENGAGEMENT_IDS).map(([dbId, appId]) => [appId, dbId]),
);

export function engagementDbId(appId: string): string {
  return APP_ID_TO_DB_ID[appId] ?? appId;
}
