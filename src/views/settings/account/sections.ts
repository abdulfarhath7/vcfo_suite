/* Which Profile section opens first (P-612): the prototype's `?tab=`, the Outlook connect return
   and the older `#section` links. Kept apart from the view so it can be tested alone. */

/** Prototype names that mean the same section. */
const TAB_ALIAS: Record<string, string> = { about: 'profile', look: 'appearance' };

/** The section to open first: `?<param>=`, then `?outlook=` (the Email section), then the hash. */
export function sectionFromLocation(
  search: string,
  hash: string,
  param: string,
  sections: readonly string[],
): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get(param) ?? '';
  const fromTab = TAB_ALIAS[raw] ?? raw;
  if (sections.includes(fromTab)) return fromTab;
  if (params.has('outlook') && sections.includes('email')) return 'email';
  const fromHash = hash.replace('#', '');
  const aliased = TAB_ALIAS[fromHash] ?? fromHash;
  if (sections.includes(aliased)) return aliased;
  return null;
}

