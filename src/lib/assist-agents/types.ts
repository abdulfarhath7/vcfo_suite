/**
 * VCFO Assist agents: shared shapes for the run log, the heal ladder and the patch queue. Pure
 * types and word lists, so the schema, the repositories, the routes and the page share them.
 * Nothing here carries a profile value: heals and evidence name fields and labels only.
 */

export const ASSIST_AGENT_RUN_STATUSES = ['running', 'waiting_user', 'done', 'failed', 'cancelled'] as const;
export type AssistAgentRunStatus = (typeof ASSIST_AGENT_RUN_STATUSES)[number];

/** A run in one of these is closed: it takes no more progress and keeps its `finishedAt`. */
export const ASSIST_AGENT_RUN_CLOSED: ReadonlySet<AssistAgentRunStatus> = new Set(['done', 'failed', 'cancelled']);

/** The heal ladder (PLAN §3). T0 is the recipe itself; T2 is on-device and never reaches Suite. */
export const ASSIST_HEAL_TIERS = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;
export type AssistHealTier = (typeof ASSIST_HEAL_TIERS)[number];

/** The tiers whose fix becomes a recipe patch proposal. */
export const ASSIST_PATCH_TIERS = ['T1', 'T3', 'T4'] as const;
export type AssistPatchTier = (typeof ASSIST_PATCH_TIERS)[number];

export const ASSIST_PATCH_STATUSES = ['proposed', 'approved', 'rejected'] as const;
export type AssistPatchStatus = (typeof ASSIST_PATCH_STATUSES)[number];

export interface AssistHeal {
  field: string;
  tier: AssistHealTier;
  ok: boolean;
}

/** A guard refusal in the extension (a captcha, OTP or password input; a Submit or Pay button). */
export interface AssistRefusal {
  kind: string;
  /** The field key or the button label; never a value. */
  target?: string;
  at?: string;
}

export interface AssistPatchProposal {
  som?: string;
  css?: string;
  label?: string;
}

/** What the heal saw, labels only. */
export interface AssistPatchEvidence {
  fieldLabel?: string;
  candidateLabels?: string[];
  chosenLabel?: string;
  confidence?: number;
  note?: string;
}

/**
 * Why the extension left a field empty for the user to fill from the client's records (the
 * no-placeholder guard, SAFETY.md G16): the profile had no value, the value was blank, the value
 * looked like a placeholder (`9999999999`, `NA`, `test`), or it was the firm's own contact detail.
 */
export const ASSIST_BLANK_REASONS = ['missing', 'empty', 'placeholder', 'firm_contact'] as const;
export type AssistBlankReason = (typeof ASSIST_BLANK_REASONS)[number];

/** One field left for the user, by key and reason. Never the value that was refused. */
export interface AssistBlank {
  field: string;
  reason: AssistBlankReason;
}

/** Who held the DSC for one signature, as the user chose it at the DSC step. */
export const ASSIST_SIGNER_KINDS = ['director', 'subscriber', 'professional'] as const;
export type AssistSignerKind = (typeof ASSIST_SIGNER_KINDS)[number];

/** A signer reference the extension sends: `director:<entry id>`, `subscriber:<n>` or `professional:self`. */
export const ASSIST_SIGNER_REF = /^(director|subscriber|professional):[A-Za-z0-9_-]{1,40}$/;

export interface AssistDscSigner {
  ref: string;
  kind: AssistSignerKind;
  /** The name Suite resolved from its own records for that reference. */
  name: string;
}

/** The browser install that ran the run: a random id the extension keeps in chrome.storage.local. */
export interface AssistDevice {
  installId: string;
  userAgent: string;
  extensionVersion?: string;
}

/** One client IP Suite saw on the run's API calls (the address App Runner's front proxy reported). */
export interface AssistClientIp {
  ip: string;
  /** The whole X-Forwarded-For chain as it arrived, truncated; the left part can be spoofed. */
  forwardedFor?: string;
  firstAt: string;
  lastAt: string;
  calls: number;
}

/**
 * The run's evidence log (after the Puneet Jain and Chennai IP cases): who ran it in Suite, which
 * MCA login they said they used (a label, never a password), who held each DSC, which browser
 * install ran it and from which IPs Suite saw the calls.
 */
export interface AssistRunEvidence {
  /** The Suite user at the time of the run (kept even if the account is later deleted). */
  userName: string | null;
  userEmail: string | null;
  mcaLoginLabel: string | null;
  dscSigners: AssistDscSigner[];
  device: AssistDevice | null;
  clientIps: AssistClientIp[];
}

/** The certifier's due-diligence checks (SAFETY.md G17). Each is ticked by a person, never by code. */
export const ASSIST_ATTESTATION_CHECKS = ['fieldsCheckedAgainstRecords', 'registeredOffice', 'subscriberSignatures'] as const;
export type AssistAttestationCheck = (typeof ASSIST_ATTESTATION_CHECKS)[number];

export interface AssistAttestationChecks {
  /** "I checked every filled field against the original records." */
  fieldsCheckedAgainstRecords: boolean;
  /** Part B: "I personally visited the registered office" or "I hold the owner's NOC". */
  registeredOffice?: 'visited' | 'owner_noc';
  /** Part B: "Each subscriber signed in my presence" or "through recorded video-KYC". */
  subscriberSignatures?: 'in_presence' | 'video_kyc';
}

export interface AssistAttestationView {
  id: string;
  runId: string;
  certifierId: string | null;
  certifierName: string | null;
  certifierEmail: string | null;
  checks: AssistAttestationChecks;
  evidenceDocumentIds: string[];
  note: string | null;
  ip: string | null;
  createdAt: string;
}

/** One row of the run log as the API and the page see it. */
export interface AssistAgentRunView {
  id: string;
  engagementId: string;
  /** The client company's name, for the staff page; null when the list did not join it. */
  companyName: string | null;
  /** Null only when the Suite account was deleted after the run; `evidence.userName` still says who. */
  userId: string | null;
  userName: string | null;
  agent: string;
  subAgent: string;
  recipeId: string;
  recipeVersion: string;
  status: AssistAgentRunStatus;
  state: string;
  fieldsTotal: number;
  fieldsFilled: number;
  heals: AssistHeal[];
  refusals: AssistRefusal[];
  aiCalls: number;
  aiTokens: number;
  srn: string | null;
  error: string | null;
  /** Fields the extension left empty for the user to fill from the client's records. */
  blanks: AssistBlank[];
  evidence: AssistRunEvidence;
  /** The certifier's checks, once recorded; the extension shows the Submit card only after this. */
  attestation: AssistAttestationView | null;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
}

export interface AssistPatchView {
  id: string;
  recipeId: string;
  recipeVersion: string;
  fieldKey: string;
  proposed: AssistPatchProposal;
  evidence: AssistPatchEvidence;
  sourceTier: AssistPatchTier;
  runId: string | null;
  proposedBy: string | null;
  status: AssistPatchStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
