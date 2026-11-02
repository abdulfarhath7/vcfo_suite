/**
 * Live director lookup by DIN (Director Identification Number, 8 digits,
 * issued by MCA). One record shape for every data source, so the chat and any
 * later screen never care which provider answered.
 */
export interface DirectorCompany {
  /** Company or LLP name as MCA shows it. */
  name: string;
  /** CIN for a company, LLPIN for an LLP, when the source gives it. */
  cin?: string;
  designation?: string;
  /** ISO dates (yyyy-mm-dd). `ceasedOn` set = a past directorship. */
  appointedOn?: string;
  ceasedOn?: string;
}

export interface DirectorRecord {
  din: string;
  name: string;
  /** Status text as the source reports it ("Approved", "Deactivated due to non-filing of DIR-3 KYC"…). */
  dinStatus: string;
  /** true / false when the status text is clear; null when it is not. */
  active: boolean | null;
  companies: DirectorCompany[];
}

/** Where the answer came from and when; shown with every reply. */
export interface LookupProvenance {
  providerId: string;
  /** Human label: "MCA via <vendor>", or "Demo data — not from MCA". */
  sourceLabel: string;
  fetchedAt: string;
}

export type DinLookupResult =
  | ({ kind: 'found'; record: DirectorRecord } & LookupProvenance)
  | ({ kind: 'not_found'; din: string } & LookupProvenance)
  | { kind: 'unavailable'; din: string; reason: 'not_configured' | 'provider_error' };

export interface DinProvider {
  id: string;
  lookup(din: string): Promise<DinLookupResult>;
}
