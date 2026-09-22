/**
 * Section tabs have no ids — only their label string (`field.section`). The
 * pack links to a tab by the slug of that label, and the step page resolves
 * the slug against the sections it currently renders.
 */
export function sectionSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
