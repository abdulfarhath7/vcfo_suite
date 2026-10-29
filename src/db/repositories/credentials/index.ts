import 'server-only';

/**
 * CREDENTIALS REPOSITORY — the client's government-portal logins, registrations,
 * addresses and directors' KYC (prototype v7p_credentials) + the PAN / TAN
 * password reveal (v7p_ids_password).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   client  — only the engagement `getMyEngagement(ctx)` resolves to (own /
 *             engagement_clients member), re-checked with
 *             `assertEngagementAccess`. A client NEVER receives a secret value
 *             unless it holds a live grant (manager-approved OTP, 10 minutes)
 *             on a scope covering that cell, and may only write inside a live
 *             Edit grant. OTPs / grants are keyed by `ctx.userId`; another
 *             person's grant never unlocks anything.
 *   manager / intern (lead) — engagements `assertEngagementAccess` allows
 *             (owned / engagement_managers / engagement_leads); they read and
 *             write without an OTP (they are the approvers).
 *   admin / super_admin — firm-wide, same as staff.
 * Every OTP request, grant, reveal, edit, undo, row change and lock writes an
 * audit event (`credentials.*`, `identifiers.reveal`) — the Access log drawer
 * and the Audit page both read audit_events.
 */

// The repository is split by concern; this file keeps the public import path.

export {
  CredentialsError,
} from './access';
export {
  getCredentials,
} from './workbook';
export {
  requestCredentialOtp,
  resendCredentialOtp,
  verifyCredentialOtp,
  lockCredentialScope,
} from './otp';
export type {
  OtpTicket,
  VerifyOutcome,
} from './otp';
export {
  updateCredentialCell,
  addCredentialRow,
  removeCredentialRow,
} from './writes';
export {
  listCredentialsLog,
} from './access-log';
export {
  revealIdentifier,
} from './identifier-reveal';
export type {
  IdentifierRevealOutcome,
} from './identifier-reveal';
export {
  listRegistrationFacts,
  setRegistrationDates,
  getRegistrationCertificateUrl,
} from './registrations';
export type {
  RegistrationDatesInput,
} from './registrations';
