import { countryWithArticle } from '@/lib/countries';

/**
 * Where the parent entity is incorporated — read by the board resolution and
 * the authorisation / acceptance letters.
 *
 * Part A asks the country (`parentEntityCountry`) and, when there is one, the
 * state or province (`parentEntityState`). Engagements from before those
 * questions keep today's output: the last comma token of the parent address,
 * "USA" when there is none, and each document's own state default.
 */
export const PARENT_COUNTRY_FIELD_ID = 'parentEntityCountry';
export const PARENT_STATE_FIELD_ID = 'parentEntityState';

export const LEGACY_PARENT_JURISDICTION = 'the United States of America';
export const DEFAULT_PARENT_STATE = 'Utah';
const DEFAULT_CERTIFICATION_PLACE = 'USA';

type Pre1 = Record<string, string | undefined>;
type ParentEngagement = { parentEntityAddress?: string | null } | null | undefined;

/** The Part A answer, or '' on an engagement that predates the question. */
export function parentCountryAnswer(pre1: Pre1): string {
  return (pre1[PARENT_COUNTRY_FIELD_ID] ?? '').trim();
}

/** Legacy fallback: the last comma token of the parent address, "USA" when absent. */
export function parentCountryFromAddress(pre1: Pre1, engagement?: ParentEngagement): string {
  const address = (pre1.parentEntityAddress ?? '').trim() || (engagement?.parentEntityAddress ?? '').trim();
  if (address) {
    const parts = address.split(',').flatMap((part) => {
      const trimmed = part.trim();
      return trimmed ? [trimmed] : [];
    });
    const last = parts[parts.length - 1];
    if (last) {
      if (/^USA$/i.test(last) || /United States of America/i.test(last)) return 'USA';
      return last;
    }
  }
  return DEFAULT_CERTIFICATION_PLACE;
}

/** Country as printed in a place / country line. */
export function resolveParentCountry(pre1: Pre1, engagement?: ParentEngagement): string {
  return parentCountryAnswer(pre1) || parentCountryFromAddress(pre1, engagement);
}

/** "the laws of {jurisdiction}" — the answered country with its article, else the legacy constant. */
export function resolveParentJurisdiction(pre1: Pre1): string {
  const country = parentCountryAnswer(pre1);
  return country ? countryWithArticle(country) : LEGACY_PARENT_JURISDICTION;
}

/**
 * State / province of incorporation. Once the country is answered the state
 * answer is final, blank included (a country without states). Before that,
 * `legacy()` supplies the document's historical value.
 */
export function resolveParentState(pre1: Pre1, legacy: () => string): string {
  if (parentCountryAnswer(pre1)) return (pre1[PARENT_STATE_FIELD_ID] ?? '').trim();
  return legacy();
}
