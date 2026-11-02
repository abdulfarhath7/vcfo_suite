/** The wire shape of `GET /api/obligations/about` (G-04). */
export interface ObligationAbout {
  id: string;
  name: string;
  area: string;
  authority: string;
  frequency: string;
  penaltyRisk: string;
  isConditional: boolean;
  /** `compliance_obligations.applicability_note`, when the library holds one. */
  applicabilityNote: string | null;
  /** The stored due rule in one plain sentence. */
  dueRule: string | null;
  about: string | null;
  whyItApplies: string | null;
  ifLate: string | null;
}
