/**
 * One company or LLP the director is associated with, as the MCA "View Director / Designated
 * Partner Details" report lists it. The FalconeBiz API fills only the first five fields; a
 * capture of the portal report fills them all, so every added field is optional in practice
 * and the table only draws a column when some row has it.
 */
export interface DirectorAssociation {
  /** CIN or FCRN for a company, LLPIN for an LLP. */
  cin: string;
  companyName: string;
  designation: string;
  /** Original date of appointment, YYYY-MM-DD when the source gave a parsable date. */
  appointmentDate: string;
  entityType: 'company' | 'llp' | '';
  /** Active, Strike Off, Under liquidation, and so on. Portal report only. */
  companyStatus: string;
  /** Promoter or Professional. Portal report only. */
  appointmentCategory: string;
  /** Date of appointment at the current designation. Portal report only. */
  currentDesignationDate: string;
  /** Date of cessation. Empty while the appointment stands; set makes the row a past one. */
  cessationDate: string;
}

/**
 * MCA director master data for one DIN, as the DIN Lookup report shows it.
 * Only what MCA publishes: there is no PAN, date of birth, address or contact here.
 */
export interface NormalizedDinData {
  din: string;
  name: string;
  /** Approved, Disqualified, Deactivated, and so on. */
  dinStatus: string;
  /** DIN approval date, YYYY-MM-DD. */
  approveDate: string;
  /** DIR-3 KYC: "Done" or "Not Done". */
  dir3Kyc: string;
  /** When the source last refreshed this record from MCA. */
  providerUpdatedAt: string;
  associations: DirectorAssociation[];
}

/** Where a record came from: the FalconeBiz API, or the MCA portal read in a person's own session. */
export type DinSource = 'falcon' | 'mca-portal';

export type McaRequestState = 'requested' | 'running' | 'done' | 'failed' | 'cancelled';

/** One ask for a DIN to be read from the MCA portal by the person's own logged-in tab. */
export interface McaDinRequest {
  id: string;
  din: string;
  state: McaRequestState;
  error: string | null;
  requestedAt: string;
  updatedAt: string;
}
