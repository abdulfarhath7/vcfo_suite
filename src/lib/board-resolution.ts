import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import {
  parseDirectorCount,
  parsePre1BoardResolutionDate,
  PRE1_DIRECTOR_GENDER_IDS,
  PRE1_DIRECTOR_INDIA_RESIDENT_IDS,
} from '@/lib/checklist-pre1-validation';
import { resolveDirectorDisplayName, resolveSignatoryDisplayName } from '@/lib/person-name';
import { nicBusinessType } from '@/lib/nic-2008';
import { resolveNocVariant, type NocVariant } from '@/lib/noc/variant';
import {
  DEFAULT_PARENT_STATE,
  resolveParentCountry,
  resolveParentJurisdiction,
  resolveParentState,
} from '@/lib/parent-jurisdiction';

export { DEFAULT_PARENT_STATE };

type BoardResolutionStatus = 'draft' | 'finalized';

export interface BoardResolutionDoc {
  content: string;
  storagePath?: string | null;
  status: BoardResolutionStatus;
  draftedAt?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  updatedAt?: string | null;
  templateFingerprint?: string | null;
  signedStoragePath?: string | null;
  signedUploadedAt?: string | null;
  signedUploadedBy?: string | null;
}

export const DEFAULT_NIC_CODES =
  '62099- Other information technology and computer service activities n.e.c, &62020- Computer consultancy and computer facilities management activities';

/** Official Board Resolution template — legal wording verbatim; only {{PLACEHOLDERS}} are substituted. */
const BOARD_RESOLUTION_TEMPLATE = `CERTIFIED TRUE COPY OF BOARD RESOLUTION

THE FOLLOWING IS A CERTIFIED TRUE COPY OF THE RESOLUTIONS PASSED BY THE BOARD OF DIRECTORS OF {{PARENT_ENTITY_NAME}} ("THE COMPANY"), SUCH RESOLUTIONS, EFFECTIVE AS OF {{RESOLUTION_EFFECTIVE_DATE}}.

"RESOLVED THAT in accordance with the applicable provisions of the laws of {{PARENT_JURISDICTION}}, the State of {{PARENT_STATE}}, and the governing documents of {{PARENT_ENTITY_NAME}}(hereinafter referred to as the "Company"), consent of the Board of Directors be and is hereby accorded to incorporate a wholly owned subsidiary of the Company in India in the name and style of {{PROPOSED_NAMES}} or such other name as may be approved by the Registrar of Companies, Ministry of Corporate Affairs, Government of India.

RESOLVED FURTHER THAT the proposed Indian subsidiary company shall be incorporated with the following main objects as per the National Industrial Classification (NIC) codes: {{NIC_CODES}}

RESOLVED FURTHER THAT the Authorized Share Capital of the proposed Indian company shall be INR {{AUTHORISED_CAPITAL}} , and the initial Paid-Up Capital shall also be INR {{PAID_UP_CAPITAL}}, to be subscribed in full by {{PARENT_ENTITY_NAME}}

RESOLVED FURTHER THAT.

{{DIRECTOR_NAMES}}

be and each hereby is authorized to take all necessary steps for the incorporation of the Indian subsidiary including but not limited to

Filing the requisite forms and documents with the Registrar of Companies in India;

Engaging legal, tax, and secretarial professionals in India for the incorporation process;

Executing Memorandum and Articles of Association and other statutory documents;

Opening and operating bank accounts in the name of the proposed company;

Appointing the first directors and statutory auditors of the company;

Taking all incidental and ancillary actions necessary for the successful incorporation and operationalization of the Indian subsidiary.

RESOLVED FURTHER THAT a copy of this resolution, certified to be true by any Authorized Officer of the Company, be provided to all authorities concerned as may be required from time to time in connection with the aforesaid matter."

##CERTIFIED TRUE COPY##

For and on behalf of {{PARENT_ENTITY_NAME}}

Authorised Person: {{SIGNATORY_NAME}}
Designation: {{SIGNATORY_DESIGNATION}}

Date: {{CERTIFICATION_DATE}}
Place: {{CERTIFICATION_PLACE}}`;

/**
 * Indian parent, investing: the same resolution under the Companies Act 2013.
 * Wording follows the firm's `noc-indian-investing.docx`.
 */
const BOARD_RESOLUTION_TEMPLATE_INDIAN_INVESTING = `CERTIFIED TRUE COPY OF BOARD RESOLUTION

THE FOLLOWING IS A CERTIFIED TRUE COPY OF THE RESOLUTIONS PASSED BY THE BOARD OF DIRECTORS OF {{PARENT_ENTITY_NAME}} ("THE COMPANY"), SUCH RESOLUTIONS, EFFECTIVE AS OF {{RESOLUTION_EFFECTIVE_DATE}}

"RESOLVED THAT in accordance with the applicable provisions of the Companies Act 2013, and the governing documents of {{PARENT_ENTITY_NAME}}(hereinafter referred to as the "Company"), consent of the Board of Directors be and is hereby accorded to incorporate a wholly owned subsidiary of the Company in India in the name and style of {{PROPOSED_NAMES}} or such other name as may be approved by the Registrar of Companies, Ministry of Corporate Affairs, Government of India.

RESOLVED FURTHER THAT the proposed Indian subsidiary company shall be incorporated with the following main objects as per the National Industrial Classification (NIC) codes: {{NIC_CODES}}

RESOLVED FURTHER THAT the Authorized Share Capital of the proposed Indian company shall be INR {{AUTHORISED_CAPITAL}} , and the initial Paid-Up Capital shall also be INR {{PAID_UP_CAPITAL}}, to be subscribed in full by {{PARENT_ENTITY_NAME}}

RESOLVED FURTHER THAT.

{{DIRECTOR_NAMES}}

be and each hereby is authorized to take all necessary steps for the incorporation of the Indian subsidiary including but not limited to

Filing the requisite forms and documents with the Registrar of Companies in India;

Engaging legal, tax, and secretarial professionals in India for the incorporation process;

Executing Memorandum and Articles of Association and other statutory documents;

Opening and operating bank accounts in the name of the proposed company;

Appointing the first directors and statutory auditors of the company;

Taking all incidental and ancillary actions necessary for the successful incorporation and operationalization of the Indian subsidiary.

RESOLVED FURTHER THAT a copy of this resolution, certified to be true by any Authorized Officer of the Company, be provided to all authorities concerned as may be required from time to time in connection with the aforesaid matter."

##CERTIFIED TRUE COPY##

For and on behalf of {{PARENT_ENTITY_NAME}}

Authorised Person: {{SIGNATORY_NAME}}
Designation: {{SIGNATORY_DESIGNATION}}

Date: {{CERTIFICATION_DATE}}
Place: {{CERTIFICATION_PLACE}}`;

/**
 * Indian parent that only lends a word of its name (no investment). Wording
 * follows the firm's `noc-indian-name-only.docx`.
 */
const BOARD_RESOLUTION_TEMPLATE_INDIAN_NAME_ONLY = `CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE COMPANY {{PARENT_ENTITY_NAME}} ON {{RESOLUTION_DAY}}, {{RESOLUTION_EFFECTIVE_DATE}}.TO GRANT NO-OBJECTION CERTIFICATE ("NOC") FOR USE OF WORD "{{NAME_WORD}}" IN THE PROPOSED NAME OF THE COMPANIES ACT 2013 TO BE INCORPORATED WITH THE REGISTRAR OF COMPANIES, MINISTRY OF CORPORATE AFFAIRS (MCA).

Pursuant to the applicable provisions of the Companies Act, 2013 and the rules made thereunder, the consent and no-objection of the Board of Directors of {{PARENT_ENTITY_NAME}}(the “Company”) and is hereby accorded for using the word “{{NAME_WORD}}” in the proposed name of a new company to be incorporated with the Registrar of Companies, Ministry of Corporate Affairs (“MCA”), under the proposed name {{PROPOSED_NAMES_OR}} or such other name containing the word “{{NAME_WORD}}” as may be approved by the Registrar of Companies.

RESOLVED FURTHER THAT the Company shall have no objection to the submission of this resolution and the corresponding No-Objection Certificate (NOC) to the Registrar of Companies, Ministry of Corporate Affairs, or any other statutory authority, wherever required, in connection with the incorporation and registration of the proposed company.

//CERTIFIED TRUE COPY//

For {{PARENT_ENTITY_NAME}}

{{SIGNATORY_NAME}}
{{SIGNATORY_DESIGNATION}}
DIN: {{SIGNATORY_DIN}}`;

/**
 * Pre-2 wording follows the NOC the ownership answers select. A standalone
 * company, or an Indian parent whose role isn't chosen yet, keeps the original
 * (foreign-parent) resolution so nothing that generated before changes.
 */
export function boardResolutionVariant(
  engagement?: Parameters<typeof resolveNocVariant>[0] | null,
): NocVariant {
  return (engagement ? resolveNocVariant(engagement) : null) ?? 'foreign-parent';
}

const BOARD_RESOLUTION_TEXT_TEMPLATES: Record<NocVariant, string> = {
  'foreign-parent': BOARD_RESOLUTION_TEMPLATE,
  'indian-investing': BOARD_RESOLUTION_TEMPLATE_INDIAN_INVESTING,
  'indian-name-only': BOARD_RESOLUTION_TEMPLATE_INDIAN_NAME_ONLY,
};

export interface BoardResolutionMergeInput {
  engagement?: Pick<
    Engagement,
    | 'parentEntityName'
    | 'parentEntityAddress'
    | 'parentEntityRegistrationNumber'
    | 'companyName'
    | 'ownershipType'
    | 'companyType'
    | 'parentIndianRelationship'
  > | null;
  pre1?: ChecklistItemResponses;
  overrides?: Partial<BoardResolutionMergeFields>;
}

export interface BoardResolutionMergeFields {
  PARENT_ENTITY_NAME: string;
  PARENT_ENTITY_ADDRESS: string;
  RESOLUTION_EFFECTIVE_DATE: string;
  PARENT_JURISDICTION: string;
  PARENT_STATE: string;
  PROPOSED_NAME_1: string;
  /** Second Part A name, or '' — the name-only NOC prints it only when present. */
  PROPOSED_NAME_2: string;
  /** "Name 1 and Name 2" — every Part A proposed name, in order. */
  PROPOSED_NAMES: string;
  NIC_CODES: string;
  AUTHORISED_CAPITAL: string;
  PAID_UP_CAPITAL: string;
  INDIAN_DIRECTOR_LINE: string;
  SECOND_DIRECTOR_LINE: string;
  /**
   * One line per Part A director ("Mr. A\nMs. B"): the resolution lists each
   * as its own bullet, so the list grows with the number of directors.
   */
  DIRECTOR_NAMES: string;
  SIGNATORY_NAME: string;
  SIGNATORY_DESIGNATION: string;
  CERTIFICATION_DATE: string;
  CERTIFICATION_PLACE: string;
  /** Weekday of the resolution date ("SATURDAY") — name-only NOC heading. */
  RESOLUTION_DAY: string;
  /** The word of the parent's name the new company borrows — name-only NOC. */
  NAME_WORD: string;
  /** Signer's DIN — not collected in Part A, so left as a blank to fill by hand. */
  SIGNATORY_DIN: string;
}

export const BOARD_RESOLUTION_MERGE_FIELD_KEYS = [
  'PARENT_ENTITY_NAME',
  'PARENT_ENTITY_ADDRESS',
  'RESOLUTION_EFFECTIVE_DATE',
  'PARENT_JURISDICTION',
  'PARENT_STATE',
  'PROPOSED_NAME_1',
  'PROPOSED_NAME_2',
  'PROPOSED_NAMES',
  'NIC_CODES',
  'AUTHORISED_CAPITAL',
  'PAID_UP_CAPITAL',
  'INDIAN_DIRECTOR_LINE',
  'SECOND_DIRECTOR_LINE',
  'DIRECTOR_NAMES',
  'SIGNATORY_NAME',
  'SIGNATORY_DESIGNATION',
  'CERTIFICATION_DATE',
  'CERTIFICATION_PLACE',
  'RESOLUTION_DAY',
  'NAME_WORD',
  'SIGNATORY_DIN',
] as const satisfies readonly (keyof BoardResolutionMergeFields)[];

function pickString(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

function formatCertificationDate(date: Date): string {
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${suffix} ${month}, ${year}`;
}

function formatResolutionDate(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
}

/** Indian numbering (e.g. 1000000 → 10,00,000). */
export function formatIndianFigures(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw.trim() || '—';
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return raw.trim();
  return n.toLocaleString('en-IN');
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsWords(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t] ?? ''}${o ? ` ${ONES[o]}` : ''}`.trim();
}

function threeDigitsWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigitsWords(rest));
  return parts.join(' ').trim();
}

/** Converts rupee amount to words for standard share-capital amounts (lakhs/crores). */
function amountToIndianRupeeWords(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n === 0) return 'Zero';

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  if (crore) parts.push(`${threeDigitsWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsWords(hundred));

  return parts.join(' ').trim();
}

/** "10,000 (Ten Thousand)" — a share count in figures and words, Indian numbering. */
export function formatShareCountClause(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  const figures = formatIndianFigures(String(Math.floor(count)));
  const words = amountToIndianRupeeWords(String(Math.floor(count)));
  return words ? `${figures} (${words})` : figures;
}

export function formatInrCapitalClause(raw: string): string {
  const figures = formatIndianFigures(raw);
  const words = amountToIndianRupeeWords(raw);
  if (!words) return figures;
  return `${figures} (Indian Rupees ${words} Only)`;
}

function formatDirectorLine(name: string): string {
  const n = stripDirectorSalutation(name).trim();
  if (!n) return '[Director name]';
  return n;
}

/** Comma-separated list with "and" before the last name (e.g. "A, B and C"). */
export function formatDirectorList(
  directors: Array<{ name: string; gender?: string | undefined }>,
): string {
  const lines: string[] = [];
  for (const d of directors) {
    const line = formatDirectorLine(d.name);
    if (line !== '[Director name]') lines.push(line);
  }

  if (lines.length === 0) return '[Second director name]';
  if (lines.length === 1) return lines[0];
  if (lines.length === 2) return `${lines[0]} and ${lines[1]}`;
  const last = lines[lines.length - 1];
  const rest = lines.slice(0, -1);
  return `${rest.join(', ')} and ${last}`;
}

/** "Mr." / "Ms." from the Part A gender; nothing when it is not recorded. */
function directorSalutation(gender: string | undefined): string {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'male') return 'Mr.';
  if (g === 'female') return 'Ms.';
  return '';
}

/** One line per named director, salutation first; a placeholder when none is named yet. */
export function formatDirectorBulletLines(
  directors: Array<{ name: string; gender?: string | undefined }>,
): string {
  const lines = directors
    .map((d) => ({ name: stripDirectorSalutation(d.name).trim(), salutation: directorSalutation(d.gender) }))
    .filter((d) => d.name)
    .map((d) => (d.salutation ? `${d.salutation} ${d.name}` : d.name));
  return lines.length > 0 ? lines.join('\n') : '[Director name]';
}

/** Every Part A proposed name joined with "and"; the first name's placeholder when none. */
export function formatProposedNames(pre1: ChecklistItemResponses): string {
  const names = [pre1.proposedName1, pre1.proposedName2]
    .map((n) => (n ?? '').trim())
    .filter(Boolean)
    .filter((n, i, all) => all.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i);
  if (names.length === 0) return '[Proposed company name 1]';
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Strip Mr./Ms./Mrs./Mr./Ms. prefixes if present in stored names. */
export function stripDirectorSalutation(name: string): string {
  return name.replace(/^(?:Mr\.?|Ms\.?|Mrs\.?|Mr\.\/Ms\.)\s+/i, '').trim();
}

function resolveParentEntityAddress(
  pre1: ChecklistItemResponses,
  engagement?: BoardResolutionMergeInput['engagement'],
): string {
  return pickString(
    pre1.parentEntityAddress,
    engagement?.parentEntityAddress,
    '[Parent entity address]',
  );
}

/** Place line at document end — the Part A country, else the parent address's country, else "USA". */
export function resolveCertificationPlace(
  pre1: ChecklistItemResponses,
  engagement?: BoardResolutionMergeInput['engagement'],
): string {
  return resolveParentCountry(pre1, engagement);
}

/**
 * Main objects clause: the Part A NIC code with its NIC-2008 description
 * ("62011- Writing, modifying, testing …"). `nicCodes` is an older free-text
 * key; the firm's default applies only when neither is answered.
 */
export function resolveNicCodesClause(pre1: ChecklistItemResponses): string {
  const code = (pre1.nicCode ?? '').trim();
  if (code) {
    const description = pickString(pre1.nicBusinessType, nicBusinessType(code)?.description);
    return description ? `${code}- ${description}` : code;
  }
  return pickString(pre1.nicCodes, DEFAULT_NIC_CODES);
}

function resolveDirectors(pre1: ChecklistItemResponses): {
  indian: { index: number; name: string; gender: string };
  others: Array<{ index: number; name: string; gender: string }>;
} {
  const count = parseDirectorCount(pre1);
  const directors = Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    const genderId = PRE1_DIRECTOR_GENDER_IDS[i];
    const residentId = PRE1_DIRECTOR_INDIA_RESIDENT_IDS[i];
    return {
      index,
      name: resolveDirectorDisplayName(pre1, index),
      gender: (pre1[genderId] ?? '').trim(),
      indiaResident: (pre1[residentId] ?? '').trim() === 'yes',
    };
  });

  const indian = directors.find((d) => d.indiaResident && d.name) ?? directors.find((d) => d.indiaResident);
  const indianIndex = indian?.index ?? 1;
  const others = directors.filter((d) => d.index !== indianIndex);

  return {
    indian: {
      index: indianIndex,
      name: indian?.name ?? '',
      gender: indian?.gender ?? '',
    },
    others,
  };
}

export function buildBoardResolutionMergeFields(
  input: BoardResolutionMergeInput,
): BoardResolutionMergeFields {
  const { engagement, pre1 = {}, overrides = {} } = input;
  const now = new Date();

  const parentName = pickString(
    pre1.parentEntityName,
    engagement?.parentEntityName,
    engagement?.companyName,
    '[Parent entity name]',
  );

  const { indian, others } = resolveDirectors(pre1);
  const indianLine = formatDirectorLine(indian.name);
  const secondLine = formatDirectorList(others);

  const authCapRaw = pickString(pre1.authorisedShareCapital, '1000000');
  const paidCapRaw = pickString(pre1.paidUpShareCapital, '100000');
  const resolutionDate = parsePre1BoardResolutionDate(pre1.boardResolutionDate) ?? now;

  const fields: BoardResolutionMergeFields = {
    PARENT_ENTITY_NAME: parentName,
    PARENT_ENTITY_ADDRESS: resolveParentEntityAddress(pre1, engagement),
    RESOLUTION_EFFECTIVE_DATE: formatResolutionDate(resolutionDate),
    PARENT_JURISDICTION: resolveParentJurisdiction(pre1),
    PARENT_STATE: resolveParentState(pre1, () => DEFAULT_PARENT_STATE),
    PROPOSED_NAME_1: pickString(pre1.proposedName1, '[Proposed company name 1]'),
    PROPOSED_NAME_2: resolveSecondProposedName(pre1),
    PROPOSED_NAMES: formatProposedNames(pre1),
    NIC_CODES: resolveNicCodesClause(pre1),
    AUTHORISED_CAPITAL: formatInrCapitalClause(authCapRaw),
    PAID_UP_CAPITAL: formatInrCapitalClause(paidCapRaw),
    INDIAN_DIRECTOR_LINE: indianLine,
    SECOND_DIRECTOR_LINE: secondLine,
    DIRECTOR_NAMES: formatDirectorBulletLines([indian, ...others]),
    SIGNATORY_NAME: pickString(resolveSignatoryDisplayName(pre1), '[Authorised person name]'),
    SIGNATORY_DESIGNATION: pickString(pre1.signatoryDesignation, '[Designation]'),
    CERTIFICATION_DATE: formatCertificationDate(resolutionDate),
    CERTIFICATION_PLACE: resolveCertificationPlace(pre1, engagement),
    RESOLUTION_DAY: resolutionDate.toLocaleString('en-US', { weekday: 'long' }).toUpperCase(),
    NAME_WORD: resolveNameWord(parentName),
    SIGNATORY_DIN: '__________',
  };

  if (!overrides) return fields;

  const merged = { ...fields };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      merged[key as keyof BoardResolutionMergeFields] = value;
    }
  }
  return merged;
}

/** Pull inline-edited cert-block values from preview plain text for merge overrides. */
export function extractBoardResolutionInlineOverrides(
  plainText: string,
  fields: BoardResolutionMergeFields,
): Partial<BoardResolutionMergeFields> {
  const lines: string[] = [];
  for (const line of plainText.replace(/\u00a0/g, ' ').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }

  const overrides: Partial<BoardResolutionMergeFields> = {};

  const behalfIdx = lines.findIndex((line) => /for and on behalf of/i.test(line));
  if (behalfIdx >= 0) {
    const nextLine = lines[behalfIdx + 1];
    if (
      nextLine &&
      !/^authorised person/i.test(nextLine) &&
      !/^designation/i.test(nextLine) &&
      !/^date:/i.test(nextLine) &&
      nextLine !== fields.PARENT_ENTITY_NAME &&
      nextLine !== fields.PARENT_ENTITY_ADDRESS
    ) {
      overrides.PARENT_ENTITY_ADDRESS = nextLine;
    }
  }

  const placeMatch = plainText.match(/Place:\s*(.+)$/im);
  if (placeMatch?.[1]?.trim()) {
    const place = placeMatch[1].trim();
    if (place !== fields.CERTIFICATION_PLACE) {
      overrides.CERTIFICATION_PLACE = place;
    }
  }

  return overrides;
}

/** Second name only when it differs from the first (same dedupe as `formatProposedNames`). */
function resolveSecondProposedName(pre1: ChecklistItemResponses): string {
  const first = (pre1.proposedName1 ?? '').trim();
  const second = (pre1.proposedName2 ?? '').trim();
  return second && second.toLowerCase() !== first.toLowerCase() ? second : '';
}

/**
 * The borrowed word defaults to the first word of the parent's name
 * ("Sampada Enterprises LLP" → "SAMPADA"); the project lead can correct it in
 * the editor before finalizing.
 */
function resolveNameWord(parentName: string): string {
  if (parentName.startsWith('[')) return '[Name word]';
  const word = parentName.trim().split(/\s+/)[0] ?? '';
  return word.replace(/[^\p{L}\p{N}&-]/gu, '').toUpperCase() || '[Name word]';
}

/** A parent incorporated in a country without states drops the "State of" phrase. */
const STATE_PHRASE = ', the State of {{PARENT_STATE}}';

function applyBoardResolutionTemplate(
  fields: BoardResolutionMergeFields,
  variant: NocVariant = 'foreign-parent',
): string {
  const template = BOARD_RESOLUTION_TEXT_TEMPLATES[variant];
  let out = fields.PARENT_STATE.trim() ? template : template.replace(STATE_PHRASE, '');
  // `“A” or “B”` for the name-only NOC; mirrors the docx's optional second name.
  out = out.replaceAll(
    '{{PROPOSED_NAMES_OR}}',
    [fields.PROPOSED_NAME_1, fields.PROPOSED_NAME_2]
      .filter((n) => n.trim())
      .map((n) => `“${n}”`)
      .join(' or '),
  );
  for (const [key, value] of Object.entries(fields)) {
    // The docx lists each director as a bullet; the text preview mirrors that.
    const text =
      key === 'DIRECTOR_NAMES'
        ? value
            .split('\n')
            .map((line) => `• ${line}`)
            .join('\n')
        : value;
    out = out.replaceAll(`{{${key}}}`, text);
  }
  return out;
}

export function generateBoardResolutionDraft(input: BoardResolutionMergeInput): string {
  return applyBoardResolutionTemplate(
    buildBoardResolutionMergeFields(input),
    boardResolutionVariant(input.engagement),
  );
}

export function parseBoardResolutionRpcPayload(data: unknown): BoardResolutionDoc | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const status = row.status === 'finalized' ? 'finalized' : 'draft';
  const content = typeof row.content === 'string' ? row.content : '';
  const storagePath =
    typeof row.storagePath === 'string'
      ? row.storagePath
      : typeof row.storage_path === 'string'
        ? row.storage_path
        : null;
  const templateFingerprint =
    typeof row.templateFingerprint === 'string'
      ? row.templateFingerprint
      : typeof row.template_fingerprint === 'string'
        ? row.template_fingerprint
        : null;
  const signedStoragePath =
    typeof row.signedStoragePath === 'string'
      ? row.signedStoragePath
      : typeof row.signed_storage_path === 'string'
        ? row.signed_storage_path
        : null;
  return {
    content,
    storagePath,
    status,
    draftedAt: typeof row.draftedAt === 'string' ? row.draftedAt : null,
    finalizedAt: typeof row.finalizedAt === 'string' ? row.finalizedAt : null,
    finalizedBy: typeof row.finalizedBy === 'string' ? row.finalizedBy : null,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
    templateFingerprint,
    signedStoragePath,
    signedUploadedAt:
      typeof row.signedUploadedAt === 'string'
        ? row.signedUploadedAt
        : typeof row.signed_uploaded_at === 'string'
          ? row.signed_uploaded_at
          : null,
    signedUploadedBy:
      typeof row.signedUploadedBy === 'string'
        ? row.signedUploadedBy
        : typeof row.signed_uploaded_by === 'string'
          ? row.signed_uploaded_by
          : null,
  };
}
