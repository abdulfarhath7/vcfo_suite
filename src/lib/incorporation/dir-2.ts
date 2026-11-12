import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { incorpDocStandardDownloadName } from '@/lib/incorporation-docs/paths';

export type Dir2DirectorKind = import('@/lib/incorporation-docs/shared').IncorpDirectorKind;

export { buildDir2MergeFields } from '@/lib/incorporation-docs/dir2';

/**
 * The name a DIR-2 downloads as (GL-08), with the director's name when it is known, for example
 * `DIR-2-Asha-Rao_Ember-Technologies-Private-Limited_11-11-2026.docx`.
 */
export function dir2DownloadFilename(
  director: Dir2DirectorKind,
  clientName: string | null | undefined,
  pre6?: ChecklistItemResponses,
  on: Date = new Date(),
): string {
  return incorpDocStandardDownloadName('dir-2', director, clientName, { pre6 }, on);
}
