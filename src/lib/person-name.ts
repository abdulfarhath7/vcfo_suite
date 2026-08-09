import type { ChecklistItemResponses } from '@/lib/checklist-responses';

/** Build a display name from first, optional middle, and last name parts. */
export function formatDisplayName(
  first?: string | null,
  middle?: string | null,
  last?: string | null,
): string {
  return [first, middle, last]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

export function resolveSignatoryDisplayName(responses: ChecklistItemResponses): string {
  const fromParts = formatDisplayName(
    responses.signatoryFirstName,
    responses.signatoryMiddleName,
    responses.signatoryLastName,
  );
  if (fromParts) return fromParts;
  return (responses.signatoryName ?? '').trim();
}

export function resolveDirectorDisplayName(
  responses: ChecklistItemResponses,
  directorIndex: number,
): string {
  const fromParts = formatDisplayName(
    responses[`director${directorIndex}FirstName`],
    responses[`director${directorIndex}MiddleName`],
    responses[`director${directorIndex}LastName`],
  );
  if (fromParts) return fromParts;
  return (responses[`director${directorIndex}Name`] ?? '').trim();
}

export type Pre6DirectorKind = 'non-resident' | 'resident';

const PRE6_DIRECTOR_PREFIX: Record<Pre6DirectorKind, string> = {
  'non-resident': 'nrDirector',
  resident: 'residentDirector',
};

/** Pre-6 director display name from split fields, with legacy full-name fallback. */
export function resolvePre6DirectorDisplayName(
  responses: ChecklistItemResponses,
  director: Pre6DirectorKind,
): string {
  const prefix = PRE6_DIRECTOR_PREFIX[director];
  const fromParts = formatDisplayName(
    responses[`${prefix}FirstName`],
    responses[`${prefix}MiddleName`],
    responses[`${prefix}LastName`],
  );
  if (fromParts) return fromParts;
  return (responses[`${prefix}FullName`] ?? '').trim();
}
