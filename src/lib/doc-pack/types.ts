import type { Engagement } from '@/data/engagements';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import type { EngagementChecklistState } from '@/lib/engagements-db';
import type { BoardResolutionDoc } from '@/lib/board-resolution';
import type { IncorpDocAudience, IncorpDocKind } from '@/lib/incorporation-docs/types';
import type { IncorpDirectorAudience } from '@/lib/incorporation-docs/shared';
import type { ProposedDirector } from '@/lib/proposed-directors';

/**
 * PRE-INCORPORATION DOCUMENT PACK — pure read model.
 *
 * Nothing in `src/lib/doc-pack/` touches the database, S3 or React. It reads
 * `checklist_state` plus the board-resolution row and says, per document the
 * app already generates, whether it is ready, what input is missing, or what
 * release it waits on. The registry only lists documents that
 * `renderIncorpDocxBuffer` / the board-resolution generator can render today.
 */

export type DocPart = 'part-a' | 'part-b';
export type DocStatus = 'ready' | 'needs-inputs' | 'waiting-release';
export type DocReleaseGate = 'br-finalized' | 'directors-accepted';
/** `attached` = the file stored by Pre-7 / BR finalize; `generated` = rendered on demand. */
export type DocSource = 'attached' | 'generated';

export type GeneratorRef =
  | { kind: 'incorp'; doc: IncorpDocKind }
  | { kind: 'board-resolution' };

/** A director the generators can render: first non-resident and first resident entry. */
export interface DocPackDirector {
  director: ProposedDirector;
  audience: IncorpDirectorAudience;
  /** `pre-15` for repeat entries, `pre-6` when rebuilt from the legacy KYC step. */
  stepId: string;
  displayName: string;
}

/** `companyName` is required by the generator helpers; the parent fields may be absent. */
export type DocPackEngagement = Pick<Engagement, 'companyName'> &
  Partial<Pick<Engagement, 'parentEntityName' | 'parentEntityAddress' | 'parentEntityRegistrationNumber'>>;

/** Everything a `RequiredInput.isPresent` may look at. Built once per evaluation. */
export interface DocPackContext {
  state: EngagementChecklistState | null | undefined;
  engagement: DocPackEngagement | null | undefined;
  brRow: BoardResolutionDoc | null | undefined;
  responses: {
    pre1: ChecklistItemResponses;
    pre5: ChecklistItemResponses;
    /** Legacy KYC map with the registered office overlaid, as the generators read it. */
    pre6: ChecklistItemResponses;
    pre7: ChecklistItemResponses;
    pre8: ChecklistItemResponses;
    pre14: ChecklistItemResponses;
  };
  directors: DocPackDirector[];
  /** Directors in `pre-15` the generators cannot render yet. */
  skippedDirectors: DocPackSkippedDirector[];
}

export interface DocPackSkippedDirector {
  index: number;
  displayName: string;
  reason: string;
}

export interface RequiredInput {
  /** Stable id, e.g. `company.name` or `director.2.pan`. */
  key: string;
  /** Short field label; the director prefix is added from `directorIndex`. */
  label: string;
  stepId: string;
  /** Slug of the section label on that step (see `sectionSlug`). */
  tabId?: string;
  directorIndex?: number;
  isPresent(ctx: DocPackContext): boolean;
}

export interface DocDefinition {
  id: string;
  part: DocPart;
  label: string;
  sourceStepIds: string[];
  expandsPer?: 'director';
  /** Director docs only: whether this director gets a copy. Default: every renderable director. */
  appliesTo?(director: DocPackDirector): boolean;
  requiredInputs(ctx: DocPackContext, director?: DocPackDirector): RequiredInput[];
  releaseGate?: DocReleaseGate;
  generate: GeneratorRef;
}

export interface DocPackMissingInput {
  key: string;
  label: string;
  stepId: string;
  tabId?: string;
  directorIndex?: number;
}

export interface DocPackBlocker {
  gate: DocReleaseGate;
  label: string;
  stepId: string;
}

export interface DocPackItem {
  /** `{docId}:{audience}` — matches the Pre-7 row keys (`incorpDocRowKey`). */
  key: string;
  docId: string;
  part: DocPart;
  label: string;
  audience: IncorpDocAudience;
  directorIndex?: number;
  directorName?: string;
  status: DocStatus;
  source: DocSource;
  /** ISO timestamp of the attached file when known. */
  attachedAt?: string;
  /** Storage path of the attached file (server resolves it; never a URL). */
  storagePath?: string;
  missing: DocPackMissingInput[];
  blockedBy?: DocPackBlocker;
  sourceStepIds: string[];
  generate: GeneratorRef;
}

export interface DocPackSummary {
  items: DocPackItem[];
  counts: Record<DocStatus, number>;
  total: number;
  skippedDirectors: DocPackSkippedDirector[];
}
