/**
 * The engine's ports. The background service worker implements them with chrome APIs
 * (`entrypoints/background.ts`); the unit tests implement them with fakes. The engine never sees
 * a chrome API, a tab id it did not get from here, or a network call it did not make through
 * `SuitePort`.
 */
import type {
  Catalog,
  FieldTarget,
  PatchProposal,
  ProfileResult,
  Recipe,
  RecipeGate,
  ResolvePayload,
  ResolveResponse,
  Run,
  ScanResult,
  ScannedField,
  SignedRecipe,
  GuardRefusal,
} from '../shared/types';
import type { FillResult } from '../portal/filler';
import type { ClickResult, PrepareResult } from '../portal/agent';
import type { BridgeNode } from '../portal/bridge';
import type { ScanOptions } from '../portal/scanner';

/** POST /api/engagements/:id/assist-runs (strict body; Suite fills agent and recipe id). */
export interface RunCreate {
  subAgent: string;
  portalHost: string;
  recipeVersion?: string;
  fieldsTotal?: number;
  state?: string;
  /** G14 evidence: the MCA login label the user typed (never a password). */
  mcaLoginLabel?: string;
  /** G14 evidence: this browser install (random id in chrome.storage.local) and its user agent. */
  device?: { installId: string; userAgent: string };
  extensionVersion?: string;
}

/**
 * PATCH /api/engagements/:id/assist-runs/:runId (strict body). Labels and counts only, never a
 * value. `heals` and `refusals` replace the stored lists, so the full lists go every time.
 */
export interface RunUpdate {
  status?: 'running' | 'waiting_user' | 'done' | 'failed' | 'cancelled';
  state?: string;
  fieldsTotal?: number;
  fieldsFilled?: number;
  heals?: Array<{ field: string; tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4'; ok: boolean }>;
  refusals?: Array<{ kind: string; target?: string; at?: string }>;
  srn?: string | null;
  error?: string | null;
  /** G16: fields left for the client's records, by key and reason (never the value). Replaces the stored list. */
  blanks?: Array<{ field: string; reason: 'missing' | 'empty' | 'placeholder' | 'firm_contact' }>;
  /** G14: who signed, as references Suite resolves to names (never a name). */
  dscSigners?: string[];
}

/** G17: what Suite says about the certifier's checks for one run. */
export interface AttestationStatus {
  recorded: boolean;
  certifierName?: string;
  at?: string;
}

/** What else the resolver call carries besides the labels-only payload. */
export interface ResolveContext {
  recipeId: string;
  runId?: string;
}

export interface SuitePort {
  catalog(): Promise<Catalog>;
  recipe(id: string): Promise<SignedRecipe>;
  profile(engagementId: string): Promise<ProfileResult>;
  createRun(engagementId: string, body: RunCreate): Promise<{ runId: string } | null>;
  updateRun(engagementId: string, runId: string, body: RunUpdate): Promise<void>;
  resolve(payload: ResolvePayload, ctx: ResolveContext): Promise<ResolveResponse>;
  proposePatch(patch: PatchProposal): Promise<void>;
  /** G17: reads the run back from Suite and reports whether the certifier's checks are recorded. */
  attestation(engagementId: string, runId: string): Promise<AttestationStatus>;
}

export type TeachResult =
  | { target: FieldTarget; field: Pick<ScannedField, 'label' | 'name' | 'som' | 'css'> }
  | { refused: GuardRefusal }
  | null;

export interface PortalPort {
  /** The portal tab's URL and whether it is the active tab of its window (G12). */
  tabInfo(): Promise<{ url: string; active: boolean } | null>;
  readBridge(): Promise<{ present: boolean; nodes: BridgeNode[] }>;
  scan(opts: ScanOptions): Promise<ScanResult>;
  prepareFill(target: FieldTarget, label: string): Promise<PrepareResult>;
  /** MAIN world: guideBridge.resolveNode(som).value = value. */
  bridgeSet(som: string, value: string): Promise<{ ok: boolean; reason?: string }>;
  fill(target: FieldTarget, value: string, label: string, bridgeTried: boolean): Promise<FillResult>;
  click(target: { css?: string; text?: string }, label: string, resultCss?: string): Promise<ClickResult>;
  attach(css: string, name: string, base64: string): Promise<{ ok: boolean; sha256?: string; reason?: string }>;
  highlightHuman(gates: RecipeGate[]): Promise<number>;
  /** G16: marks controls "You fill this from the client's records". Never writes to them. */
  markForRecords(targets: Array<{ target: FieldTarget; label: string }>): Promise<number>;
  readSrn(pattern?: string): Promise<string | null>;
  teach(label: string): Promise<TeachResult>;
  cancelTeach(): Promise<void>;
  banner(text: string | null): Promise<void>;
}

/** What survives a service-worker restart or a tab reload (chrome.storage.session). */
export interface Persisted {
  run: Run;
  recipe?: Recipe;
  profile?: ProfileResult;
  /** The dropped signed PDF, base64. Its bytes are never changed (G6). */
  pdfBase64?: string;
  /** G16: the firm's own contact details from the catalog read at the run start. */
  firmContacts?: { emails: string[]; phones: string[] };
}

export interface StorePort {
  load(): Promise<Persisted | null>;
  save(p: Persisted): Promise<void>;
  clear(): Promise<void>;
}
