/**
 * APPROVALS and DATE REQUESTS — the pure read models both pages (and their
 * sidebar badges) count from. No React, no fetch.
 *
 * Approvals · Waiting = the live inbox list (`usePendingApprovals('manager')`,
 * src/lib/pending-approvals.ts — the same rows Today counts), one card per row,
 * in four kinds: board resolution (pre-2), a lead's request for approval, a
 * client submission, and a lead's ask to send a step to the client.
 * Approvals · Decided = the latest decision each step's state records
 * (review accept / reject stamps, the send-to-client decision), same steps and
 * same engagements as Waiting, last 30 days.
 *
 * Date requests = the client's timeline change requests (the one real kind:
 * the live tool has no lead → manager date-change request). Waiting comes from
 * the per-engagement read Today and the client overview share; Decided from
 * GET /api/timeline-requests.
 */
import type { Engagement, OwnershipType } from '@/data/engagements';
import { getItem } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import type { PendingApprovalRow } from '@/lib/pending-approvals';
import { primaryPhaseItems } from '@/lib/project-stuck';
import { isDirectFlowStep, MANAGER_APPROVAL_STEP_ID } from '@/lib/pre-inc-direct-flow';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import { buildTimelineBlocks } from '@/lib/client-portal/master-plan';
import type { TimelinePhaseDates, TimelineRequestDto } from '@/lib/client-home';
import type { BookTimelineRequest } from '@/lib/timeline-request-history';
import { extractItemResponses, fieldsForOwnership, getClientResponseFields, isStepRemarksField } from '@/lib/checklist-responses';
import { isRepeatField, repeatEntries } from '@/lib/checklist-repeat';
import { stageOf, stepCode, type ClientStage } from '../clients/model';

/* ---------------------------------------------------------------- days */

const IST_MS = 5.5 * 3600e3;
const at = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`);
export const daysBetween = (a: string, b: string): number => Math.round((at(b) - at(a)) / 864e5);
/** A date or timestamp → the day it falls on in India. */
export function istDay(v?: string | null): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t + IST_MS).toISOString().slice(0, 10);
}
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export type Scope = 'all' | ClientStage;
type StateFor = (e: Engagement) => Record<string, ChecklistItemStateSlice | undefined> | undefined;
type Person = { id: string; name: string };

/* ================================================================ approvals */

export type ApKind = 'board' | 'lead' | 'client' | 'fill';
export const AP_KIND_LABEL: Record<ApKind, string> = {
  board: 'Board resolution',
  lead: 'Lead request',
  client: 'Client submission',
  fill: 'Send to client',
};
/** Live button words per kind (ManagerBoardResolutionReview, ChecklistReviewActions, RequestClientFill). */
export const AP_ACTION: Record<ApKind, { yes: string; no: string; done: string; back: string }> = {
  board: { yes: 'Approve and send to client', no: 'Send back', done: 'Approved', back: 'Sent back' },
  lead: { yes: 'Approve', no: 'Reject', done: 'Approved', back: 'Rejected' },
  client: { yes: 'Accept', no: 'Reject', done: 'Accepted', back: 'Rejected' },
  fill: { yes: 'Approve and send', no: 'Decline', done: 'Sent to client', back: 'Declined' },
};

export interface ApFrom {
  name: string;
  role: 'project lead' | 'client';
}

export interface ApWaiting {
  id: string;
  kind: ApKind;
  row: PendingApprovalRow;
  e: Engagement;
  itemId: string;
  title: string;
  code: string;
  stage: ClientStage;
  from: ApFrom;
  /** The lead's note on a send-to-client ask. */
  note?: string;
  since?: string;
  days?: number;
  due?: string;
  late: boolean;
  lateDays: number;
}

export interface ApDecided {
  id: string;
  kind: ApKind;
  e: Engagement;
  itemId: string;
  title: string;
  code: string;
  stage: ClientStage;
  ok: boolean;
  label: string;
  /** ISO timestamp of the decision. */
  at: string;
  by?: string;
  note?: string;
  from: ApFrom;
}

export interface ApInput {
  rows: PendingApprovalRow[];
  engagements: Engagement[];
  stateFor: StateFor;
  people: Person[];
  me?: { id: string; role: string };
  today: string;
  scope: Scope;
  decidedDays?: number;
}

export interface ApModel {
  waiting: ApWaiting[];
  decided: ApDecided[];
  /** Counts before the Stage filter. */
  all: { waiting: number; decided: number };
}

export function kindOf(row: Pick<PendingApprovalRow, 'clientFill' | 'itemId' | 'reviewSource'>): ApKind {
  if (row.clientFill) return 'fill';
  if (row.itemId === MANAGER_APPROVAL_STEP_ID) return 'board';
  return row.reviewSource === 'lead_manager_request' ? 'lead' : 'client';
}

function leadName(e: Engagement, people: Person[]): string | undefined {
  const key = e.internId?.trim() || e.leadIds?.[0];
  return key ? people.find((p) => p.id === key)?.name : undefined;
}

function clientName(e: Engagement): string {
  return e.clientDisplayName?.trim() || e.clientEmail?.trim() || 'The client';
}

/** The live inbox's visibility rule (use-pending-approvals 'manager'): not a project another manager owns. */
export function visibleInInbox(e: Pick<Engagement, 'managerId'>, me?: { id: string; role: string }): boolean {
  return !(me?.role === 'manager' && e.managerId && e.managerId !== me.id);
}

export function buildApprovals(input: ApInput): ApModel {
  const { today, scope, people } = input;
  const byId = new Map(input.engagements.map((e) => [e.id, e]));
  const stageCache = new Map<string, ClientStage>();
  const stage = (e: Engagement) => {
    let s = stageCache.get(e.id);
    if (!s) {
      s = stageOf(e, input.stateFor(e));
      stageCache.set(e.id, s);
    }
    return s;
  };
  const inScope = (e: Engagement) => scope === 'all' || stage(e) === scope;

  /* ---------- waiting: the live rows */
  const models = new Map<string, ReturnType<typeof buildIncorporationModel>>();
  const all: ApWaiting[] = [];
  for (const row of input.rows) {
    const e = byId.get(row.engagementId);
    if (!e) continue;
    const kind = kindOf(row);
    const state = input.stateFor(e) ?? {};
    const slice = state[row.itemId];
    let model = models.get(e.id);
    if (!model) {
      model = buildIncorporationModel(state, e.schedule ?? null, today);
      models.set(e.id, model);
    }
    const step = model.byId[row.itemId];
    const lead = leadName(e, people);
    const from: ApFrom =
      kind === 'client'
        ? { name: clientName(e), role: 'client' }
        : { name: (kind === 'fill' ? row.clientFill?.requestedByName : undefined) ?? lead ?? 'Your project lead', role: 'project lead' };
    const since = istDay(kind === 'fill' ? slice?.clientFillRequest?.requestedAt : slice?.clientSubmittedAt ?? slice?.lastEditedAt);
    all.push({
      id: `${e.id}:${row.itemId}:${kind === 'fill' ? 'fill' : 'review'}`,
      kind,
      row,
      e,
      itemId: row.itemId,
      title: getItem(row.itemId)?.title ?? row.itemId,
      code: stepCode(row.itemId),
      stage: stage(e),
      from,
      note: row.clientFill?.note?.trim() || undefined,
      since,
      days: since ? Math.max(0, daysBetween(since, today)) : undefined,
      due: step?.due,
      late: Boolean(step?.late),
      lateDays: step?.lateDays ?? 0,
    });
  }
  all.sort(
    (a, b) =>
      Number(b.late) - Number(a.late) ||
      b.lateDays - a.lateDays ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
      (b.days ?? 0) - (a.days ?? 0) ||
      a.e.companyName.localeCompare(b.e.companyName),
  );

  /* ---------- decided: the latest decision each step records */
  const cutoff = istDay(new Date(at(today) - (input.decidedDays ?? 30) * 864e5).toISOString().slice(0, 10))!;
  const decided: ApDecided[] = [];
  const items = primaryPhaseItems();
  for (const e of input.engagements) {
    if (e.stage === 'Operational Readiness' || !visibleInInbox(e, input.me)) continue;
    const state = input.stateFor(e) ?? {};
    const lead = leadName(e, people) ?? 'Your project lead';
    for (const item of items) {
      const s = state[item.id];
      if (!s) continue;
      const base = { e, itemId: item.id, title: item.title, code: stepCode(item.id), stage: stage(e) };
      const rs = s.reviewStatus;
      const reviewed = istDay(s.reviewedAt);
      if (!isDirectFlowStep(item.id) && (rs === 'accepted' || rs === 'rejected') && s.reviewedAt && reviewed && reviewed >= cutoff) {
        // A client's change request writes the same reject shape; it is not a decision of the firm.
        const clientAsk = rs === 'rejected' && s.approval?.state === 'change_requested' && s.approval.changeRequestedAt === s.reviewedAt;
        if (!clientAsk) {
          const kind: ApKind = item.id === MANAGER_APPROVAL_STEP_ID ? 'board' : s.reviewSource === 'lead_manager_request' ? 'lead' : 'client';
          const ok = rs === 'accepted';
          const by =
            s.reviewedBy && s.reviewedBy === input.me?.id
              ? 'You'
              : ok && s.approval?.managerApprovedBy === s.reviewedBy
                ? s.approval?.managerApprovedByName
                : undefined;
          decided.push({
            ...base,
            id: `${e.id}:${item.id}:review`,
            kind,
            ok,
            label: ok ? AP_ACTION[kind].done : AP_ACTION[kind].back,
            at: s.reviewedAt,
            by,
            note: ok ? undefined : s.rejectionNote?.trim() || undefined,
            from: kind === 'client' ? { name: clientName(e), role: 'client' } : { name: lead, role: 'project lead' },
          });
        }
      }
      const f = s.clientFillRequest;
      const fd = istDay(f?.decidedAt);
      if (f && (f.status === 'approved' || f.status === 'declined') && f.decidedAt && fd && fd >= cutoff) {
        const ok = f.status === 'approved';
        decided.push({
          ...base,
          id: `${e.id}:${item.id}:fill`,
          kind: 'fill',
          ok,
          label: ok ? AP_ACTION.fill.done : AP_ACTION.fill.back,
          at: f.decidedAt,
          by: f.decidedBy && f.decidedBy === input.me?.id ? 'You' : f.decidedByName,
          note: f.decisionNote?.trim() || undefined,
          from: { name: f.requestedByName ?? lead, role: 'project lead' },
        });
      }
    }
  }
  decided.sort((a, b) => b.at.localeCompare(a.at));

  return {
    waiting: all.filter((w) => inScope(w.e)),
    decided: decided.filter((d) => inScope(d.e)),
    all: { waiting: all.length, decided: decided.length },
  };
}

/** Read-only answers of a step (label → value), as the live board-resolution review lists Client Details. */
export function answerRows(itemId: string, slice: ChecklistItemStateSlice | undefined, ownership?: OwnershipType): Array<{ id: string; label: string; value: string }> {
  const item = getItem(itemId);
  if (!item) return [];
  const responses = extractItemResponses(item, slice);
  const rows: Array<{ id: string; label: string; value: string }> = [];
  for (const field of fieldsForOwnership(item.id, getClientResponseFields(item), ownership)) {
    if (isRepeatField(field)) {
      repeatEntries(responses, field).forEach((entry) => {
        const value = Object.values(entry.values).filter((v) => v.trim()).join(' · ');
        if (value) rows.push({ id: `${field.id}.${entry.id}`, label: `${field.entryLabel ?? field.label} ${entry.index}`, value });
      });
      continue;
    }
    const raw = (responses[field.id] ?? '').trim();
    if (!raw) continue;
    const value = field.type === 'file' ? 'Uploaded' : field.options?.find((o) => o.value === raw)?.label ?? raw;
    rows.push({ id: field.id, label: field.label, value });
  }
  return rows;
}

/** The fields the client will be asked to fill (send-to-client preview). */
export function clientFieldLabels(itemId: string, ownership?: OwnershipType): string[] {
  const item = getItem(itemId);
  if (!item) return [];
  return fieldsForOwnership(item.id, getClientResponseFields(item), ownership)
    .filter((f) => !isStepRemarksField(f))
    .map((f) => f.entryLabel ?? f.label);
}

/* ================================================================ date requests */

export interface DrPhase {
  id: TimelinePhaseDates['id'];
  name: string;
  nowFrom?: string;
  nowTo?: string;
  askFrom: string;
  askTo: string;
  milestone: boolean;
  /** Days the end (or the COI day) moves; undefined when today's plan has no such phase. */
  shift?: number;
}

export interface DrWaiting {
  id: string;
  e: Engagement;
  stage: ClientStage;
  req: TimelineRequestDto;
  who: string;
  sent: string;
  coiNow?: string;
  coiAsk?: string;
  slip: number;
  phases: DrPhase[];
}

export type DrResult = 'ok' | 'no' | 'wd';
export const DR_RESULT_LABEL: Record<DrResult, string> = { ok: 'Approved', no: 'Declined', wd: 'Withdrawn' };

export interface DrDecided {
  id: string;
  e: Engagement;
  stage: ClientStage;
  req: BookTimelineRequest;
  who: string;
  sent: string;
  result: DrResult;
  /** ISO timestamp it closed. */
  at: string;
  by?: string;
  note?: string;
  coiNow?: string;
  coiAsk?: string;
  slip: number;
  phases: DrPhase[];
}

export interface DrInput {
  engagements: Engagement[];
  stateFor: StateFor;
  /** Per engagement id: GET /api/engagements/:id/timeline-requests. */
  lists: Record<string, TimelineRequestDto[] | undefined>;
  closed: BookTimelineRequest[];
  meId?: string;
  today: string;
  scope: Scope;
}

export interface DrModel {
  waiting: DrWaiting[];
  decided: DrDecided[];
  all: { waiting: number; decided: number };
}

const isMilestone = (id: string) => id === 'coi';

/** Every pending request across the book, unscoped (the sidebar badge). */
export function countPendingTimelineRequests(lists: Record<string, Array<{ status: string }> | undefined>): number {
  return Object.values(lists).reduce((n, l) => n + (l ?? []).filter((r) => r.status === 'pending').length, 0);
}

export function buildDateRequests(input: DrInput): DrModel {
  const { today, scope } = input;
  const byId = new Map(input.engagements.map((e) => [e.id, e]));
  const inScope = (s: ClientStage) => scope === 'all' || s === scope;

  const waiting: DrWaiting[] = [];
  for (const e of input.engagements) {
    const pend = (input.lists[e.id] ?? []).filter((r) => r.status === 'pending');
    if (!pend.length) continue;
    const state = input.stateFor(e) ?? {};
    const blocks = buildTimelineBlocks(buildIncorporationModel(state, e.schedule ?? null, today), e.incorporationDate) ?? [];
    const now = new Map(blocks.map((b) => [b.id, b]));
    for (const req of pend) {
      const phases: DrPhase[] = req.phases.map((p) => {
        const b = now.get(p.id);
        const milestone = isMilestone(p.id);
        return {
          id: p.id,
          name: p.name || b?.name || p.id,
          nowFrom: b?.from,
          nowTo: b?.to,
          askFrom: p.from,
          askTo: p.to,
          milestone,
          shift: b ? daysBetween(milestone ? b.from : b.to, milestone ? p.from : p.to) : undefined,
        };
      });
      const coiNow = now.get('coi')?.from ?? req.coiFrom;
      const coiAsk = req.phases.find((p) => p.id === 'coi')?.from ?? req.coiTo;
      waiting.push({
        id: req.id,
        e,
        stage: stageOf(e, state),
        req,
        who: req.requestedByName?.trim() || clientName(e),
        sent: istDay(req.createdAt) ?? today,
        coiNow,
        coiAsk,
        slip: coiNow && coiAsk ? daysBetween(coiNow, coiAsk) : req.slipDays,
        phases,
      });
    }
  }
  waiting.sort((a, b) => a.req.createdAt.localeCompare(b.req.createdAt));

  const decided: DrDecided[] = [];
  for (const req of input.closed) {
    const e = byId.get(req.engagementId);
    if (!e || req.status === 'pending') continue;
    const result: DrResult = req.status === 'approved' ? 'ok' : req.status === 'rejected' ? 'no' : 'wd';
    decided.push({
      id: req.id,
      e,
      stage: stageOf(e, input.stateFor(e)),
      req,
      who: req.requestedByName?.trim() || clientName(e),
      sent: istDay(req.createdAt) ?? today,
      result,
      at: req.decidedAt ?? req.updatedAt,
      by: req.decidedBy && req.decidedBy === input.meId ? 'You' : req.decidedByName,
      note: req.decisionNote,
      coiNow: req.coiFrom,
      coiAsk: req.coiTo,
      slip: req.slipDays,
      phases: req.phases.map((p) => ({ id: p.id, name: p.name || p.id, askFrom: p.from, askTo: p.to, milestone: isMilestone(p.id) })),
    });
  }
  decided.sort((a, b) => b.at.localeCompare(a.at));

  return {
    waiting: waiting.filter((w) => inScope(w.stage)),
    decided: decided.filter((d) => inScope(d.stage)),
    all: { waiting: waiting.length, decided: decided.length },
  };
}

/** "slips 10 days" · "10 days earlier" · "no change". */
export function slipText(n: number): string {
  if (!n) return 'no change';
  return n > 0 ? `slips ${plural(n, 'day')}` : `${plural(-n, 'day')} earlier`;
}
