/**
 * OTHER COMPANY INTERESTS — a director's existing directorships / holdings,
 * printed in DIR-8's prior-directorship table and counted on DIR-2.
 *
 * `pre-15` entries carry up to three structured interests
 * (`otherInterest{i}Company` …). Legacy `pre-6` KYC carries up to five
 * (`{prefix}OtherCompanyInterest{i}Name` …). Both land in the synthesised
 * `pre-6` map under the legacy names, so the generators read one shape.
 */

export const PRE15_MAX_OTHER_INTERESTS = 3;
export const PRE6_MAX_OTHER_INTERESTS = 5;

export interface OtherCompanyInterest {
  company: string;
  cin: string;
  designation: string;
  from: string;
  to: string;
}

/** `pre-15` entry part → legacy `pre-6` part. */
export const PRE15_INTEREST_PARTS = {
  Company: 'Name',
  Cin: 'Cin',
  Designation: 'Designation',
  From: 'StartDate',
  To: 'EndDate',
} as const;

const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const LLPIN_RE = /^[A-Z]{3}-\d{4}$/;

/** Format check only (21-character CIN or `AAA-0000` LLPIN) — never a registry lookup. */
export function isValidCinOrLlpin(value: string): boolean {
  const v = value.trim().toUpperCase();
  return CIN_RE.test(v) || LLPIN_RE.test(v);
}

/** Interests from a `pre-6`-shaped map for one director prefix; entries without a company name are skipped. */
export function otherInterestsFromPre6(
  pre6: Record<string, string | undefined>,
  prefix: string,
): OtherCompanyInterest[] {
  if ((pre6[`${prefix}HasOtherCompanyInterest`] ?? '').trim() === 'no') return [];
  const out: OtherCompanyInterest[] = [];
  for (let i = 1; i <= PRE6_MAX_OTHER_INTERESTS; i += 1) {
    const get = (part: string) => (pre6[`${prefix}OtherCompanyInterest${i}${part}`] ?? '').trim();
    const company = get('Name');
    if (!company) continue;
    out.push({
      company,
      cin: get('Cin'),
      designation: get('Designation'),
      from: get('StartDate'),
      to: get('EndDate'),
    });
  }
  return out;
}
