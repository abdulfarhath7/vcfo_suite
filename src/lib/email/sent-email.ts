/** One email a person sent from a card (GL-07), read from its `email.sent` audit record. */
export interface SentEmailRow {
  at: string;
  by: string;
  to: string[];
  subject: string;
}
