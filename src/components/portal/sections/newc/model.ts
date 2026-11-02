/**
 * The new-client seat (prototype a58b_newc.js) as pure functions over the REAL
 * data: the client's checklist state (client-redacted), the step model, the
 * incorporation extras (file requests, board resolution) and the home needs.
 *
 *  - Master data = the client-intake steps (`CLIENT_INTAKE_STEP_IDS`: Part A
 *    pre-1 and Part B pre-13 … pre-16). Each step's fill progress is counted
 *    from the catalog's required fields and the real step validator
 *    (`validateStepAgainstState`, the same function the submit route runs).
 *  - Declarations = the board resolution (pre-2 / pre-3) and the incorporation
 *    drafts SBC generates on pre-7 (`*DraftUrl`) and shares with the client
 *    (`sharedIncorpDraftDocs`), one signer per proposed director plus the
 *    company documents. A signed copy is the legacy pre-8 upload or a file
 *    request on the draft's signed field.
 *  - Overview = a status pill, six stages over SPICe+ Part A / Part B / MCA.
 */
import { coerceStatusCode, getItem, type ChecklistField, type ChecklistItem } from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';
import { extractItemResponses, fieldsForOwnership, getClientResponseFields, type ChecklistItemResponses } from '@/lib/checklist-responses';
import { applyShowWhen, isRepeatField, repeatEntries, repeatFieldId, repeatFieldLabel } from '@/lib/checklist-repeat';
import { validateStepAgainstState } from '@/lib/checklist-step-validation';
import { approvalStateOf } from '@/lib/checklist-step-approval';
import { CLIENT_INTAKE_STEP_IDS, isLeadOnlyField } from '@/lib/pre-inc-direct-flow';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import type { PortalIncorporationModel, PortalStep, StepOwner } from '@/lib/client-portal/step-model';
import type { ClientFileRequestDto, IncorporationBoardResolution } from '@/lib/client-portal/incorporation-types';
import type { HomeNeedRequest } from '@/lib/client-home';
import { directorAudienceKind } from '@/lib/incorporation-docs/audiences';
import { incorpDraftDocSlotsFromResponses } from '@/lib/incorporation-docs/paths';
import { isIncorpDraftSharedWithClient, isIncorpSlotSetFrozen, signedUploadFieldForIncorpDraft } from '@/lib/incorporation-docs/share';
import { INCORP_DOC_DEFINITIONS, incorpDocAppliesToEngagement, type IncorpDocAudience, type IncorpDocKind } from '@/lib/incorporation-docs/types';
import { directorResponsesFromState, resolveDirectorEntries, type StepStateMap } from '@/lib/proposed-directors';

export type StateMap = Record<string, ChecklistItemStateSlice | undefined>;

export interface EngagementLike {
  ownershipType?: OwnershipType;
  parentEntityName?: string | null;
  parentEntityAddress?: string | null;
  parentEntityRegistrationNumber?: string | null;
}

/* ================================================================ master data */

/** Where an intake step is for the client. */
export type IntakeState = 'open' | 'with' | 'done' | 'locked';

export interface IntakeMissing {
  id: string;
  label: string;
  /** the form tab / section it sits in */
  section?: string;
  message: string;
}

export interface IntakeStep {
  id: string;
  title: string;
  /** "Part A" / "Part B" */
  part: string;
  state: IntakeState;
  /** required details the client fills (concrete ids, repeat entries expanded) */
  required: number;
  /** required details with a valid value */
  filled: number;
  /** what still blocks Submit (missing or invalid), in form order */
  missing: IntakeMissing[];
  /** the real validator passes (Submit would be accepted) */
  ready: boolean;
  step: PortalStep;
}

const BLANK = (v: string | undefined) => !(v ?? '').trim();

function itemResponses(item: ChecklistItem, state: StateMap): ChecklistItemResponses {
  return extractItemResponses(item, state[item.id]);
}

/** Required ids the client fills on one step (visible, not lead-only), with labels, in form order. */
export function requiredDetails(item: ChecklistItem, responses: ChecklistItemResponses, ownershipType?: OwnershipType): { id: string; label: string; section?: string }[] {
  const fields: ChecklistField[] = applyShowWhen(fieldsForOwnership(item.id, getClientResponseFields(item), ownershipType), responses);
  const out: { id: string; label: string; section?: string }[] = [];
  for (const f of fields) {
    if (isLeadOnlyField(item.id, f.id)) continue;
    if (isRepeatField(f)) {
      for (const entry of repeatEntries(responses, f)) {
        for (const ef of f.entryFields) {
          if (!ef.required) continue;
          if (ef.showWhen && (entry.values[ef.showWhen.field] ?? '').trim() !== ef.showWhen.value) continue;
          out.push({ id: repeatFieldId(f.id, entry.id, ef.id), label: `${ef.label} · ${f.entryLabel ?? 'Entry'} ${entry.index}`, section: ef.section ?? f.section });
        }
      }
      continue;
    }
    if (f.required) out.push({ id: f.id, label: f.label, section: f.section });
  }
  return out;
}

function labelOf(item: ChecklistItem, responses: ChecklistItemResponses, id: string, ownershipType?: OwnershipType): string {
  const fields = fieldsForOwnership(item.id, getClientResponseFields(item), ownershipType);
  return repeatFieldLabel(fields, responses, id) ?? fields.find((f) => f.id === id)?.label ?? item.title;
}

/** Fill progress of one intake step: n / m required details, from the catalog and the real validator. */
export function intakeProgress(
  item: ChecklistItem,
  state: StateMap,
  engagement?: EngagementLike | null,
): { required: number; filled: number; missing: IntakeMissing[]; ready: boolean } {
  const responses = itemResponses(item, state);
  const v = validateStepAgainstState({ itemId: item.id, responses, state: state as StepStateMap, engagement: engagement ?? null });
  const errors = Object.fromEntries(Object.entries(v.errors).filter(([k]) => !isLeadOnlyField(item.id, k)));
  const req = requiredDetails(item, responses, engagement?.ownershipType);
  const reqIds = new Set(req.map((r) => r.id));
  // a validator may require a detail the catalog does not flag (bespoke Part A / Part B rules)
  for (const k of Object.keys(errors)) {
    const top = getClientResponseFields(item).find((f) => f.id === k);
    if (!reqIds.has(k) && !(top && isRepeatField(top)) && BLANK(responses[k])) {
      req.push({ id: k, label: labelOf(item, responses, k, engagement?.ownershipType) });
      reqIds.add(k);
    }
  }
  const filled = req.filter((r) => !BLANK(responses[r.id]) && !errors[r.id]).length;
  const missing: IntakeMissing[] = [];
  const seen = new Set<string>();
  for (const r of req) {
    if (!BLANK(responses[r.id]) && !errors[r.id]) continue;
    seen.add(r.id);
    missing.push({ id: r.id, label: r.label, section: r.section, message: errors[r.id] ?? 'This field is required.' });
  }
  for (const [k, m] of Object.entries(errors)) {
    if (seen.has(k)) continue;
    missing.push({ id: k, label: labelOf(item, responses, k, engagement?.ownershipType), message: m });
  }
  return { required: req.length, filled, missing, ready: Object.keys(errors).length === 0 };
}

export function intakeStateOf(s: PortalStep): IntakeState {
  if (s.kind === 'done') return 'done';
  if (s.kind === 'with') return 'with';
  if (s.kind === 'you' || s.kind === 'prog') return 'open';
  return 'locked';
}

/** The client-intake steps in checklist order, each with its state and fill progress. */
export function intakeSteps(model: PortalIncorporationModel, state: StateMap, engagement?: EngagementLike | null): IntakeStep[] {
  return model.steps
    .filter((s) => CLIENT_INTAKE_STEP_IDS.has(s.id))
    .map((s) => {
      const st = intakeStateOf(s);
      const p = intakeProgress(s.item, state, engagement);
      // a sent / accepted step is complete as far as the client is concerned
      const sent = st === 'done' || st === 'with';
      return {
        id: s.id,
        title: s.title,
        part: s.phaseNo === 1 ? 'SPICe+ Part A' : 'SPICe+ Part B',
        state: st,
        required: p.required,
        filled: sent ? p.required : p.filled,
        missing: sent ? [] : p.missing,
        ready: sent || p.ready,
        step: s,
      };
    });
}

export interface IntakeTotals {
  required: number;
  filled: number;
  pct: number;
  /** steps the client can fill now */
  open: number;
  /** open steps still missing something */
  needing: number;
  /** first open step with something missing, else the first open step */
  first?: IntakeStep;
  allSent: boolean;
}

/** The `.nbar` numbers across the intake steps that are open, sent or done (locked steps do not count yet). */
export function intakeTotals(steps: IntakeStep[]): IntakeTotals {
  const live = steps.filter((s) => s.state !== 'locked');
  const required = live.reduce((n, s) => n + s.required, 0);
  const filled = live.reduce((n, s) => n + Math.min(s.filled, s.required), 0);
  const open = steps.filter((s) => s.state === 'open');
  const needing = open.filter((s) => s.missing.length > 0);
  return {
    required,
    filled,
    pct: required ? Math.round((filled / required) * 100) : live.length ? 100 : 0,
    open: open.length,
    needing: needing.length,
    first: needing[0] ?? open[0],
    allSent: steps.length > 0 && steps.every((s) => s.state === 'done' || s.state === 'with'),
  };
}

/* ================================================================ declarations */

/** One declaration row: a draft for one signer. */
export type DeclState = 'signed' | 'sign' | 'prep' | 'todo';

export interface DeclDoc {
  rowKey: string;
  doc: IncorpDocKind;
  audience: IncorpDocAudience;
  /** "DIR-2", "INC-33 — MOA" */
  label: string;
  optional: boolean;
  generated: boolean;
  shared: boolean;
  state: DeclState;
  /** where the signed copy lives (legacy pre-8 upload or a fulfilled file request) */
  signedPath?: string;
  /** the file request SBC opened for the signed copy, if any */
  request?: ClientFileRequestDto;
}

export interface DeclSigner {
  /** director audience key or 'company' */
  key: IncorpDocAudience;
  name: string;
  /** "Director 1 · Non-resident" / "Company documents" */
  sub: string;
  docs: DeclDoc[];
}

export interface Declarations {
  signers: DeclSigner[];
  generated: number;
  shared: number;
  signed: number;
  /** shared drafts still waiting for a signed copy */
  toSign: number;
}

/** Every incorporation draft SBC prepares from the client's details, grouped by signer, with its state. */
export function declarationsOf(state: StateMap, requests: ClientFileRequestDto[], engagement?: EngagementLike | null): Declarations {
  const pre7Item = getItem('pre-7');
  const pre8Item = getItem('pre-8');
  const pre7State = state['pre-7'];
  const pre7 = pre7Item ? extractItemResponses(pre7Item, pre7State) : {};
  const pre8 = pre8Item ? extractItemResponses(pre8Item, state['pre-8']) : {};
  const { pre6 } = directorResponsesFromState(state as StepStateMap);
  const entries = resolveDirectorEntries(state as StepStateMap);
  const names = new Map(entries.map((e, i) => [e.key as string, { name: e.displayName, n: i + 1 }]));
  const slots = incorpDraftDocSlotsFromResponses(pre7, { pre6, frozen: isIncorpSlotSetFrozen(pre7State) }).filter((s) =>
    incorpDocAppliesToEngagement(s.doc, engagement ? { ownershipType: engagement.ownershipType ?? null } : null),
  );

  const bySigner = new Map<string, DeclSigner>();
  for (const slot of slots) {
    const generated = Boolean(slot.path.trim());
    // without the directors on file the slot set falls back to two placeholder directors: list only real ones
    if (slot.audience !== 'company' && !names.has(slot.audience) && !generated) continue;
    const shared = generated && isIncorpDraftSharedWithClient(pre7State, slot.doc, slot.audience);
    const field = signedUploadFieldForIncorpDraft(slot.doc, slot.audience);
    const reqs = field ? requests.filter((r) => r.fieldId === field) : [];
    const request = reqs.find((r) => !r.fulfilledAt) ?? reqs[reqs.length - 1];
    const signedPath = (field ? pre8[field]?.trim() : '') || (request?.fulfilledAt ? request.fulfilledPath : undefined) || undefined;
    const st: DeclState = signedPath ? 'signed' : shared ? 'sign' : generated ? 'prep' : 'todo';
    const doc: DeclDoc = {
      rowKey: `${slot.doc}:${slot.audience}`,
      doc: slot.doc,
      audience: slot.audience,
      label: INCORP_DOC_DEFINITIONS[slot.doc].label,
      optional: Boolean(slot.optional),
      generated,
      shared,
      state: st,
      signedPath,
      request,
    };
    let signer = bySigner.get(slot.audience);
    if (!signer) {
      const who = names.get(slot.audience);
      const kind = slot.audience === 'company' ? '' : directorAudienceKind(slot.audience) === 'resident' ? 'Resident of India' : 'Non-resident';
      signer = {
        key: slot.audience,
        name: slot.audience === 'company' ? 'Company documents' : who?.name ?? 'Director',
        sub: slot.audience === 'company' ? 'Memorandum, articles and subscriber papers' : `Director ${who?.n ?? ''} · ${kind}`.replace('  ', ' '),
        docs: [],
      };
      bySigner.set(slot.audience, signer);
    }
    signer.docs.push(doc);
  }
  const rank = (k: string) => (k === 'company' ? 1e6 : names.get(k)?.n ?? 1e5);
  const signers = [...bySigner.values()].sort((a, b) => rank(a.key) - rank(b.key));
  const all = signers.flatMap((s) => s.docs);
  return {
    signers,
    generated: all.filter((d) => d.generated).length,
    shared: all.filter((d) => d.shared).length,
    signed: all.filter((d) => d.state === 'signed').length,
    toSign: all.filter((d) => d.state === 'sign').length,
  };
}

/* ---------------------------------------------------------------- board resolution */

export type BoardState = 'prep' | 'approve' | 'sign' | 'sent' | 'done';

export const BOARD_LABEL: Record<BoardState, string> = {
  prep: 'SBC is drafting',
  approve: 'Review & approve',
  sign: 'To sign',
  sent: 'Signed copy with SBC',
  done: 'Received by SBC',
};

/** Where the board resolution is (pre-2 draft → pre-3 signed copy). */
export function boardStateOf(model: PortalIncorporationModel, br: IncorporationBoardResolution | null | undefined): BoardState {
  const s2 = model.byId['pre-2'];
  const s3 = model.byId['pre-3'];
  if (s3?.kind === 'done') return 'done';
  if (approvalStateOf(s2?.slice) === 'pending_client' || approvalStateOf(s3?.slice) === 'pending_client') return 'approve';
  const s3Path = String((s3?.slice?.responses as Record<string, unknown> | undefined)?.signedBoardResolutionUrl ?? '').trim();
  if (br?.signedUploadedAt || s3Path || s3?.kind === 'with') return 'sent';
  if (br?.status === 'finalized' || s2?.kind === 'done') return 'sign';
  return 'prep';
}

/** The step whose StepWork carries the board stage now (the approval on pre-2, else the signed copy on pre-3). */
export function boardStepId(model: PortalIncorporationModel): 'pre-2' | 'pre-3' {
  const s2 = model.byId['pre-2'];
  return s2 && s2.kind !== 'done' ? 'pre-2' : 'pre-3';
}

/* ================================================================ overview */

export interface NewcStage {
  key: string;
  title: string;
  who: 'YOU' | 'SBC' | 'MCA';
  state: 'done' | 'now' | 'up';
  steps: PortalStep[];
  /** the step to open (current, else first not done, else last) */
  focus?: PortalStep;
  /** where the stage's work lives in this seat */
  go?: 'nmd' | 'nsign';
}

const STAGES: { key: string; title: string; ids: string[]; go?: 'nmd' | 'nsign' }[] = [
  { key: 'a', title: 'Client details (Part A)', ids: ['pre-1'], go: 'nmd' },
  { key: 'br', title: 'Board resolution', ids: ['pre-2', 'pre-3'], go: 'nsign' },
  { key: 'name', title: 'Name approval', ids: ['pre-4', 'pre-5'] },
  { key: 'b', title: 'Master data (Part B)', ids: ['pre-13', 'pre-14', 'pre-15', 'pre-16'], go: 'nmd' },
  { key: 'kyc', title: 'KYC, DSC & SPICe+ filing', ids: ['pre-7', 'pre-9', 'pre-10'], go: 'nsign' },
  { key: 'coi', title: 'Certificate of incorporation', ids: ['pre-11', 'pre-12'] },
];

const WHO: Record<StepOwner, NewcStage['who']> = { client: 'YOU', sbc: 'SBC', mca: 'MCA' };
const ACTIVE = new Set(['you', 'prog', 'with']);

/** "Where your incorporation is": SPICe+ Part A, Part B and MCA as six stages over the real steps. */
export function newcStages(model: PortalIncorporationModel): NewcStage[] {
  const stages = STAGES.map((g) => {
    const steps = g.ids.map((id) => model.byId[id]).filter((s): s is PortalStep => Boolean(s));
    const done = steps.length > 0 && steps.every((s) => s.kind === 'done');
    const cur = steps.find((s) => s.kind === 'you') ?? steps.find((s) => ACTIVE.has(s.kind));
    const focus = cur ?? steps.find((s) => s.kind !== 'done') ?? steps[steps.length - 1];
    return {
      key: g.key,
      title: g.title,
      who: focus ? WHO[focus.owner] : 'SBC',
      state: done ? 'done' : cur ? 'now' : 'up',
      steps,
      focus,
      go: g.go,
    } satisfies NewcStage;
  });
  // nothing active (between steps): the first stage not done is "now"
  if (!stages.some((s) => s.state === 'now')) {
    const first = stages.find((s) => s.state !== 'done');
    if (first) first.state = 'now';
  }
  return stages;
}

/**
 * Where the company stands on SPICe+ (owner, 2026-10-29: Overview, Master data and Declarations are part
 * of the ONE client portal, so they must read right for every client, not only a new incorporation):
 *   pre          — not incorporated yet: the client fills master data and signs declarations;
 *   incorporated — the Certificate of Incorporation is issued (CIN / date recorded, or step 12 done);
 *   skipped      — every SPICe+ step (phases 1–2) is marked not applicable: the project started after
 *                  incorporation, so there is nothing to fill or sign here.
 */
export type SpiceStage = 'pre' | 'incorporated' | 'skipped';

const notApplicable = (s: PortalStep) => coerceStatusCode(s.slice?.status) === 'not-applicable';

export function spiceStageOf(model: PortalIncorporationModel, incorporated: boolean): SpiceStage {
  const spice = model.phases.filter((p) => p.no === 1 || p.no === 2).flatMap((p) => p.steps);
  if (spice.length === 0 || spice.every(notApplicable)) return 'skipped';
  if (incorporated || model.byId['pre-12']?.kind === 'done') return 'incorporated';
  return 'pre';
}

export interface NewcStatus {
  pill: 'due' | 'up' | 'ok' | 'over';
  label: string;
  sub: string;
  cta?: { label: string; go: 'nmd' | 'nsign' };
}

/** The company strip's status pill, line and call to action. */
export function newcStatus(input: {
  model: PortalIncorporationModel;
  intake: IntakeStep[];
  totals: IntakeTotals;
  board: BoardState;
  decl: Declarations;
  signNeeds: number;
  /** default 'pre' (a new incorporation) */
  stage?: SpiceStage;
}): NewcStatus {
  const { model, intake, totals, board, decl, signNeeds, stage = 'pre' } = input;
  if (stage !== 'pre') {
    // only an explicit request for a signed paper can still need the client; old SPICe+ drafts cannot
    if (signNeeds > 0)
      return {
        pill: 'due',
        label: 'Your turn · sign',
        sub: `SBC asked for ${signNeeds} signed paper${signNeeds === 1 ? '' : 's'}. Upload the signed copies.`,
        cta: { label: 'Sign declarations', go: 'nsign' },
      };
    return stage === 'skipped'
      ? { pill: 'ok', label: 'Incorporated', sub: 'SPICe+ incorporation is not part of your project with SBC, so there is nothing to fill or sign here.' }
      : { pill: 'ok', label: 'Incorporated', sub: 'The Certificate of Incorporation is issued. Your master data and declarations are complete.' };
  }
  const returned = intake.find((s) => s.state === 'open' && s.step.slice?.reviewStatus === 'rejected');
  if (returned) return { pill: 'over', label: 'Sent back · your turn', sub: `SBC sent ${returned.title} back with notes. Correct it and send it again.`, cta: { label: 'Correct master data', go: 'nmd' } };
  if (totals.open > 0)
    return {
      pill: 'due',
      label: 'Your turn · master data',
      sub: `Fill the company and director details once (${totals.filled} of ${totals.required} done). SBC prepares every declaration from them.`,
      cta: { label: 'Fill master data', go: 'nmd' },
    };
  const toSign = decl.toSign + (board === 'sign' || board === 'approve' ? 1 : 0) + signNeeds;
  if (toSign > 0)
    return {
      pill: 'due',
      label: board === 'approve' && decl.toSign === 0 ? 'Your turn · approve' : 'Your turn · sign',
      sub: decl.toSign > 0
        ? `Your declarations are ready. Download, sign in ink and upload them (${decl.signed} of ${decl.shared} signed copies in).`
        : board === 'approve'
          ? 'SBC has prepared a step for your approval. Check it and approve it.'
          : board === 'sign'
            ? 'The board resolution is ready. Download it, have a director sign it on letterhead and upload the signed copy.'
            : `SBC asked for ${signNeeds} signed paper${signNeeds === 1 ? '' : 's'}. Upload the signed copies.`,
      cta: { label: 'Sign declarations', go: 'nsign' },
    };
  const filed = model.byId['pre-10']?.kind === 'done';
  if (model.byId['pre-12']?.kind === 'done') return { pill: 'ok', label: 'Incorporated', sub: 'The Certificate of Incorporation is issued.' };
  if (filed) return { pill: 'up', label: 'Filed with MCA', sub: 'SPICe+ Part B is filed. The Ministry of Corporate Affairs is processing it; SBC tracks it daily.' };
  const cur = model.current;
  if (cur?.kind === 'you') return { pill: 'due', label: `Your turn · ${cur.title}`, sub: `${cur.title} waits for you.` };
  if (totals.allSent && decl.shared === 0)
    return { pill: 'up', label: 'With SBC · preparing', sub: 'SBC has your master data and prepares the declarations for signature.' };
  return { pill: 'up', label: cur ? `With SBC · ${cur.title}` : 'With SBC', sub: cur ? `SBC is working on ${cur.title}. Nothing for you to do right now.` : 'Nothing for you to do right now.' };
}

/** Count for the Declarations badge: everything waiting on the client's signature. */
export function signBadge(board: BoardState, decl: Declarations, needs: HomeNeedRequest[], stage: SpiceStage = 'pre'): number {
  const asked = needs.filter((n) => n.kind === 'sign').length;
  // once incorporated (or when SPICe+ is not part of the project) only explicit requests count
  if (stage !== 'pre') return asked;
  return decl.toSign + (board === 'sign' || board === 'approve' ? 1 : 0) + asked;
}
