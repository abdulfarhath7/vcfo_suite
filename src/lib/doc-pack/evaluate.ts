import { checklist } from '@/data/checklist';
import type { BoardResolutionDoc } from '@/lib/board-resolution';
import { extractItemResponses, type ChecklistItemResponses } from '@/lib/checklist-responses';
import type { EngagementChecklistState } from '@/lib/engagements-db';
import { directorsAccepted } from '@/lib/api/incorporation-docs-errors';
import { draftUrlFieldFor, type IncorpDocAudience } from '@/lib/incorporation-docs/types';
import { incorpDocRowKey } from '@/lib/incorporation-docs/paths';
import {
  displayName,
  directorEntriesFromDirectors,
  directorResponsesFromState,
  PROPOSED_DIRECTORS_STEP_ID,
  readProposedDirectors,
  type ProposedDirector,
} from '@/lib/proposed-directors';
import { DOC_PACK_REGISTRY } from '@/lib/doc-pack/registry';
import type {
  DocDefinition,
  DocPackBlocker,
  DocPackContext,
  DocPackDirector,
  DocPackEngagement,
  DocPackItem,
  DocPackMissingInput,
  DocPackSkippedDirector,
  DocPackSummary,
  DocStatus,
  RequiredInput,
} from '@/lib/doc-pack/types';

export interface EvaluateDocPackInput {
  state: EngagementChecklistState | null | undefined;
  brRow?: BoardResolutionDoc | null;
  engagement?: DocPackEngagement | null;
}

const LEGACY_DIRECTOR_ID = /^legacy-/;
const SKIP_UNSUPPORTED = 'More directors of this residency than documents are generated for';
const SKIP_NO_RESIDENCY = 'Resident status not set';

function responsesFor(state: EvaluateDocPackInput['state'], itemId: string): ChecklistItemResponses {
  const item = checklist.find((c) => c.id === itemId);
  return item ? extractItemResponses(item, state?.[itemId]) : {};
}

/**
 * Every director with a residency becomes an audience (`resident`,
 * `resident-2` …, see `directorEntriesFromDirectors`); anything else is
 * reported, not silently dropped.
 */
export function renderableDirectors(directors: ProposedDirector[]): {
  directors: DocPackDirector[];
  skipped: DocPackSkippedDirector[];
} {
  const entries = directorEntriesFromDirectors(directors);
  const byId = new Map(entries.map((e) => [e.director.id, e]));
  const out: DocPackDirector[] = [];
  const skipped: DocPackSkippedDirector[] = [];
  for (const director of directors) {
    const name = displayName(director.values) || `Director ${director.index}`;
    const resident = (director.values.indiaResident ?? '').trim();
    const stepId = LEGACY_DIRECTOR_ID.test(director.id) ? 'pre-6' : PROPOSED_DIRECTORS_STEP_ID;
    const entry = byId.get(director.id);
    if (entry) {
      out.push({ director, audience: entry.key, stepId, displayName: name });
    } else {
      skipped.push({
        index: director.index,
        displayName: name,
        reason: resident === 'yes' || resident === 'no' ? SKIP_UNSUPPORTED : SKIP_NO_RESIDENCY,
      });
    }
  }
  return { directors: out, skipped };
}

export function buildDocPackContext(input: EvaluateDocPackInput): DocPackContext {
  const { state } = input;
  const { pre1, pre6 } = directorResponsesFromState(state);
  const { directors, skipped } = renderableDirectors(readProposedDirectors(state));
  return {
    state,
    engagement: input.engagement,
    brRow: input.brRow,
    responses: {
      pre1,
      pre5: responsesFor(state, 'pre-5'),
      pre6,
      pre7: responsesFor(state, 'pre-7'),
      pre8: responsesFor(state, 'pre-8'),
      pre14: responsesFor(state, 'pre-14'),
    },
    directors,
    skippedDirectors: skipped,
  };
}

/** Pre-7 stores `{uuid}/{field}/{epochMillis}-{name}`; the millis are the attach time. */
export function attachedAtFromStoragePath(path: string): string | undefined {
  const match = /\/(\d{13})-[^/]+$/.exec(path);
  if (!match) return undefined;
  const millis = Number(match[1]);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : undefined;
}

function toMissing(input: RequiredInput): DocPackMissingInput {
  return {
    key: input.key,
    label: input.label,
    stepId: input.stepId,
    ...(input.tabId ? { tabId: input.tabId } : {}),
    ...(input.directorIndex !== undefined ? { directorIndex: input.directorIndex } : {}),
  };
}

function directorsStepId(ctx: DocPackContext): string {
  const legacy = ctx.directors.length > 0 && ctx.directors.every((d) => d.stepId === 'pre-6');
  return legacy ? 'pre-6' : PROPOSED_DIRECTORS_STEP_ID;
}

function blockerFor(ctx: DocPackContext, gate: NonNullable<DocDefinition['releaseGate']>): DocPackBlocker | null {
  if (gate === 'br-finalized') {
    const row = ctx.brRow;
    if (row?.status === 'finalized' && row.storagePath?.trim()) return null;
    return { gate, label: 'Waiting for the board resolution to be finalized', stepId: 'pre-2' };
  }
  if (directorsAccepted(ctx.state)) return null;
  return {
    gate,
    label: 'Waiting for the proposed directors to be accepted',
    stepId: directorsStepId(ctx),
  };
}

function sourceStepIdsFor(def: DocDefinition, ctx: DocPackContext): string[] {
  const directorStep = directorsStepId(ctx);
  return def.sourceStepIds.map((id) => (id === PROPOSED_DIRECTORS_STEP_ID ? directorStep : id));
}

function evaluateItem(
  def: DocDefinition,
  ctx: DocPackContext,
  audience: IncorpDocAudience,
  director?: DocPackDirector,
): DocPackItem {
  const base = {
    key: `${def.id}:${audience}`,
    docId: def.id,
    part: def.part,
    label: def.label,
    audience,
    ...(director ? { directorIndex: director.director.index, directorName: director.displayName } : {}),
    sourceStepIds: sourceStepIdsFor(def, ctx),
    generate: def.generate,
  };

  // Board resolution: the finalized file is the only thing the pack ever serves.
  if (def.generate.kind === 'board-resolution') {
    const blocker = def.releaseGate ? blockerFor(ctx, def.releaseGate) : null;
    if (blocker) {
      return { ...base, status: 'waiting-release', source: 'attached', missing: [], blockedBy: blocker };
    }
    const row = ctx.brRow;
    return {
      ...base,
      status: 'ready',
      source: 'attached',
      missing: [],
      ...(row?.finalizedAt ? { attachedAt: row.finalizedAt } : {}),
      ...(row?.storagePath ? { storagePath: row.storagePath } : {}),
    };
  }

  // Attached version wins: a file Pre-7 already stored is served as-is.
  const field = draftUrlFieldFor(def.generate.doc, audience);
  const attachedPath = field ? (ctx.responses.pre7[field] ?? '').trim() : '';
  if (attachedPath) {
    const attachedAt = attachedAtFromStoragePath(attachedPath);
    return {
      ...base,
      status: 'ready',
      source: 'attached',
      missing: [],
      storagePath: attachedPath,
      ...(attachedAt ? { attachedAt } : {}),
    };
  }

  const blocker = def.releaseGate ? blockerFor(ctx, def.releaseGate) : null;
  if (blocker) {
    return { ...base, status: 'waiting-release', source: 'generated', missing: [], blockedBy: blocker };
  }

  const missing = def
    .requiredInputs(ctx, director)
    .filter((input) => !input.isPresent(ctx))
    .map(toMissing);
  const seen = new Set<string>();
  const unique = missing.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)));
  return {
    ...base,
    status: unique.length > 0 ? 'needs-inputs' : 'ready',
    source: 'generated',
    missing: unique,
  };
}

export function evaluateDocPack(input: EvaluateDocPackInput): DocPackSummary {
  const ctx = buildDocPackContext(input);
  const items: DocPackItem[] = [];

  for (const def of DOC_PACK_REGISTRY) {
    if (def.expandsPer === 'director') {
      for (const director of ctx.directors) {
        if (def.appliesTo && !def.appliesTo(director)) continue;
        items.push(evaluateItem(def, ctx, director.audience, director));
      }
      continue;
    }
    items.push(evaluateItem(def, ctx, 'company'));
  }

  const counts: Record<DocStatus, number> = { ready: 0, 'needs-inputs': 0, 'waiting-release': 0 };
  for (const item of items) counts[item.status] += 1;

  return { items, counts, total: items.length, skippedDirectors: ctx.skippedDirectors };
}

/** Row key of a Pre-7 draft slot, for callers that map pack items back to share rows. */
export function docPackItemRowKey(item: DocPackItem): string | null {
  return item.generate.kind === 'incorp' ? incorpDocRowKey(item.generate.doc, item.audience) : null;
}

export function docPackItemByKey(summary: DocPackSummary, key: string): DocPackItem | undefined {
  return summary.items.find((item) => item.key === key);
}
