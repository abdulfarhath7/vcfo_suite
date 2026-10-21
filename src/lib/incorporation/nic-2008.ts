import NIC_2008 from '@/data/nic-2008.json';

/**
 * NIC-2008 (National Industrial Classification) at the 5-digit sub-class
 * level — the "main division of industrial activity" SPICe+ Part A asks for.
 *
 * `src/data/nic-2008.json` is `[code, subclassDescription, classDescription]`
 * for all 1,302 sub-classes, generated from the official MSME NIC-2008 PDF
 * (text layer parsed deterministically; the source's 11 printed typos and 1
 * omission corrected against the surrounding code sequence). Pure lookup —
 * no fuzzy matching, no AI.
 */
export const NIC_CODE_RE = /^\d{5}$/;

export interface NicBusinessType {
  code: string;
  /** Sub-class (5-digit) description — the "business type" shown to the user. */
  description: string;
  /** Parent class (4-digit) description, for context. */
  classDescription: string;
}

const BY_CODE: ReadonlyMap<string, NicBusinessType> = new Map(
  (NIC_2008 as [string, string, string][]).map(([code, description, classDescription]) => [
    code,
    { code, description, classDescription },
  ]),
);

export function isNicCodeFormat(value: string | null | undefined): boolean {
  return NIC_CODE_RE.test((value ?? '').trim());
}

/** The business type for a 5-digit NIC-2008 code, or null when the code is not in the table. */
export function nicBusinessType(code: string | null | undefined): NicBusinessType | null {
  const trimmed = (code ?? '').trim();
  if (!NIC_CODE_RE.test(trimmed)) return null;
  return BY_CODE.get(trimmed) ?? null;
}

export const NIC_CODE_COUNT = BY_CODE.size;

/** Repeat group of extra NIC codes on Part A (`pre-1`); see `checklist-responses.ts`. */
export const ADDITIONAL_NIC_CODES_GROUP_ID = 'additionalNicCodes';

export interface NicCodeLine {
  code: string;
  /** Stored business type, else the NIC-2008 description, else ''. */
  description: string;
}

/**
 * Every NIC code on a Part A record, main code first, then the additional ones
 * in list order. Blank codes are skipped; a code outside NIC-2008 is kept with
 * whatever description was stored, because the lead may know better than the
 * table (unknown codes are a warning, not an error).
 */
export function readNicCodes(pre1: Record<string, string | undefined>): NicCodeLine[] {
  const out: NicCodeLine[] = [];
  const push = (rawCode: string | undefined, stored: string | undefined) => {
    const code = (rawCode ?? '').trim();
    if (!code) return;
    const description = (stored ?? '').trim() || nicBusinessType(code)?.description || '';
    out.push({ code, description });
  };
  push(pre1.nicCode, pre1.nicBusinessType);
  const entryIds = (pre1[ADDITIONAL_NIC_CODES_GROUP_ID] ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  for (const entryId of entryIds) {
    const prefix = `${ADDITIONAL_NIC_CODES_GROUP_ID}.${entryId}`;
    push(pre1[`${prefix}.code`], pre1[`${prefix}.businessType`]);
  }
  return out;
}
