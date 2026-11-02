/**
 * The old shell's Profile page (`/app/<role>/profile?tab=`) is the console's Settings page
 * (`/app/<role>/settings?section=`). Pure, so the redirecting routes (server components) can use it.
 *
 * Old tabs: profile · security · notify · email · appearance · settings.
 * Console sections: profile · security · outlook · look. Tabs with no section land on Profile.
 */
const TAB_TO_SECTION: Record<string, string> = {
  profile: 'profile',
  security: 'security',
  email: 'outlook',
  appearance: 'look',
};

export function settingsHrefFromProfile(base: string, tab: string | string[] | undefined): string {
  const t = Array.isArray(tab) ? tab[0] : tab;
  const section = t ? TAB_TO_SECTION[t.trim().toLowerCase()] : undefined;
  return `${base}/settings${section ? `?section=${section}` : ''}`;
}
