import { parseDirectorCount, PRE1_DIRECTOR_GENDER_IDS } from '@/lib/checklist-pre1-validation';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { stripDirectorSalutation } from '@/lib/board-resolution';
import {
  directorField,
  pickString,
  resolveProposedCompanyName,
  type IncorpMergeInput,
} from '@/lib/incorporation-docs/shared';
import { resolvePre6DirectorDisplayName } from '@/lib/person-name';

export interface AoaMergeFields {
  PROPOSED_COMPANY_NAME: string;
  /** Numbered director list for AOA (e.g. "1. Mr. … 2. Mr. …"). */
  AOA_DIRECTORS_LIST: string;
}

export const AOA_MERGE_FIELD_KEYS = [
  'PROPOSED_COMPANY_NAME',
  'AOA_DIRECTORS_LIST',
] as const satisfies readonly (keyof AoaMergeFields)[];

function directorSalutation(gender: string | undefined): string {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'female') return 'Ms.';
  return 'Mr.';
}

function formatAoaDirectorLine(index: number, name: string, gender: string | undefined): string {
  const clean = stripDirectorSalutation(name).trim();
  if (!clean) return `${index}. [Director name]`;
  return `${index}. ${directorSalutation(gender)} ${clean}`;
}

/** Directors for AOA: Pre-6 NR + resident names; fall back to Pre-1 director slots. */
function buildAoaDirectorsList(
  pre1: ChecklistItemResponses,
  pre6: ChecklistItemResponses,
): string {
  const lines: string[] = [];
  const nrName = resolvePre6DirectorDisplayName(pre6, 'non-resident');
  const resName = resolvePre6DirectorDisplayName(pre6, 'resident');
  if (nrName) {
    lines.push(
      formatAoaDirectorLine(1, nrName, pre1[PRE1_DIRECTOR_GENDER_IDS[0]] as string | undefined),
    );
  }
  if (resName) {
    lines.push(
      formatAoaDirectorLine(
        lines.length + 1,
        resName,
        pre1[PRE1_DIRECTOR_GENDER_IDS[1]] as string | undefined,
      ),
    );
  }

  const count = parseDirectorCount(pre1);
  const existingDirectorNames = new Set<string>();
  for (let i = 1; i <= count; i += 1) {
    const first = (pre1[`director${i}FirstName`] ?? '').trim();
    const last = (pre1[`director${i}LastName`] ?? '').trim();
    const legacy = (pre1[`director${i}Name`] ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ') || legacy;
    if (!name) continue;
    const genderId = PRE1_DIRECTOR_GENDER_IDS[i - 1];
    const gender = (pre1[genderId] ?? '') as string;
    const stripped = stripDirectorSalutation(name);
    if (existingDirectorNames.has(stripped)) continue;
    existingDirectorNames.add(stripped);
    lines.push(formatAoaDirectorLine(lines.length + 1, name, gender));
  }

  return lines.length > 0 ? lines.join(' ') : '1. [Director name]';
}

export function buildAoaMergeFields(
  input: IncorpMergeInput & { overrides?: Partial<AoaMergeFields> },
): AoaMergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, overrides = {} } = input;
  return {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    AOA_DIRECTORS_LIST: buildAoaDirectorsList(pre1, pre6),
    ...overrides,
  };
}

export function collectAoaMissingFields(input: IncorpMergeInput): string[] {
  const missing: string[] = [];
  const companyName = resolveProposedCompanyName(input.pre5 ?? {}, input.pre1 ?? {}, input.engagement);
  if (!companyName || companyName.startsWith('[')) {
    missing.push('Approved company name (Pre-5) or proposed name (Pre-1)');
  }

  const pre6 = input.pre6 ?? {};
  const nr = directorField(pre6, 'non-resident', 'FullName');
  const res = directorField(pre6, 'resident', 'FullName');
  if (!nr && !res) {
    missing.push('At least one director full name (Pre-6)');
  }

  return missing;
}
