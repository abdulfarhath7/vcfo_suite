/**
 * Tally live sync (docs/specs/receivables/TALLY-LIVE.md): the JSON the connector sends and the
 * JSON the Sheet tab reads. Pure types and constants, safe for the browser bundle.
 */

export type TallyJobType = 'sales' | 'receipts';
export type TallyJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'expired';

/** One voucher as the connector reads it from TallyPrime (the fixed contract; amounts are positive INR). */
export type TallyVoucher = {
  guid: string;
  voucherType: string;
  voucherNo: string;
  date: string;
  partyName: string;
  gstin?: string | null;
  amount: number;
  /** Bill-wise references; on a receipt, each name is the invoice number it settles. */
  bills?: Array<{ name: string; amount: number }>;
  /** Not in the contract; honoured when a connector sends it. */
  cancelled?: boolean;
};

export type TallyJobResult = { ok: false; error: string } | { ok: true; company: string; vouchers: TallyVoucher[] };

/** A queued job's age after which it expires, and a running job's age after which it fails. */
export const QUEUED_TTL_MS = 2 * 60_000;
export const RUNNING_TTL_MS = 10 * 60_000;
/** The connector counts as online when it was seen this recently. */
export const ONLINE_MS = 2 * 60_000;
export const PC_OFF_MESSAGE = 'The Tally PC did not answer. Is it on, with the connector running?';
export const PC_STOPPED_MESSAGE = 'The Tally PC stopped answering before it sent the data. Try again.';

export type TallyJobDto = {
  id: string;
  type: TallyJobType;
  from: string;
  to: string;
  status: TallyJobStatus;
  error: string | null;
  stats: { vouchers: number; staged: number; skipped: number; receipts: number; notes?: string[] } | null;
  requestedByName: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type TallyConnectorDto = {
  id: string;
  name: string;
  tallyCompany: string | null;
  version: string | null;
  tallyReachable: boolean | null;
  lastSeenAt: string | null;
  pairedAt: string | null;
  online: boolean;
};

export type TallyStatusDto = {
  connector: TallyConnectorDto | null;
  /** An unused pairing code is waiting (its value is shown only once, when it is made). */
  pairingExpiresAt: string | null;
  activeJob: TallyJobDto | null;
  recent: TallyJobDto[];
};

export type PairingCodeDto = { code: string; expiresAt: string };
