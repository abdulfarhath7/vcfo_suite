'use client';

/**
 * Incorporation pages — data + the prototype's copy and helpers, fed by the
 * real step model (`usePortalIncorporation`, src/lib/client-portal/step-model.ts),
 * the client overview (team, COI, deliverables) and `GET /api/client/incorporation`
 * (file requests, upload metadata, window setter, board-resolution people).
 */
import { companyShortName } from '@/lib/client-portal/company';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useClientOverview } from '@/lib/use-client-overview';
import { clientIncorporationStepPath } from '@/lib/project-step-path';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import { filterFieldsByViewer } from '@/lib/checklist/checklist-field-access';
import { isStepRemarksField } from '@/lib/checklist/checklist-responses';
import { usePortalIncorporation, todayIST } from '../../hooks';
import { usePortal, type DrillRow, type DrillTab, type WhatsThisAnswer } from '../../PortalProvider';
import type { PortalStep, PortalPhase, PortalIncorporationModel } from '@/lib/client-portal/step-model';
import type { ClientIncorporationExtras, ClientFileRequestDto } from '@/lib/client-portal/incorporation-types';
import { fmt, type GlyphKind, type OwnKey } from './ui';

/* ---------------- prototype constants (Northwind → the client's short name) ---------------- */

export const PH = ['Name Application', 'Incorporation', 'Post-Incorporation', 'Registration'];
export const PHL = ['SPICe+ Part A', 'SPICe+ Part B', 'Post-incorporation', 'Registration'];
export const PH_TIP = [
  'SPICe+ Part A · name approval with MCA',
  'SPICe+ Part B · the company is formed',
  'Post-incorporation · the first 180 days',
  'Registrations · tax, labour, trade and FEMA',
];
export const phInfo = (s: string) => [
  `Name approval with MCA (SPICe+ Part A): ${s}’s details, the board resolution, and the name application SBC files for ${s}.`,
  'SPICe+ Part B: capital, registered office, directors and subscribers, KYC and DSC, the filing, and the Certificate of Incorporation.',
  'What a new company must do in its first months: board meeting, bank account, share capital, share certificates and ROC filings.',
  'The registrations the company needs to operate, grouped as in VCFO Suite: General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand and FEMA.',
];
export const phWhy = (s: string) => [
  'Nothing else can start until MCA approves the company name.',
  `It ends with the Certificate of Incorporation: ${s} exists from that date.`,
  'Most of these have legal deadlines counted from the incorporation date (30 to 180 days).',
  'The company needs these to invoice, hire and trade; GST comes first.',
];
export const PH_SRC = [
  'Companies Act 2013 · SPICe+ Part A (RUN)',
  'Companies Act 2013 · SPICe+ Part B, AGILE-PRO-S',
  'Companies Act 2013 · INC-20A, ADT-1, SH-1',
  'GST, labour, trade and FEMA rules',
];
export const PH_WAIT = [
  '',
  '',
  'Post-incorporation starts once the Certificate of Incorporation is issued.',
  'Registrations start after the Certificate of Incorporation. GST comes first.',
];
export const INFO_WHY: Record<string, string> = {
  coi: 'It is the date your company legally exists; everything after it is counted from that day.',
  phases: 'It shows at a glance which phase is late, on time or not started.',
  docs: 'Missing or old documents are the most common reason MCA sends a filing back.',
  noc: 'Without it MCA rejects the registered office proof.',
  timeline: 'It shows who did what and when, so nothing waits unnoticed.',
};

export type K = 'done' | 'you' | 'prog' | 'with' | 'up';
export type LK = K | 'next';
export const KL: Record<LK, string> = { done: 'Done', you: 'Waiting', prog: 'In progress', with: 'With SBC', up: 'Upcoming', next: 'Next' };
export const KCOL: Record<K, string> = { done: '#15805f', you: '#c8620e', prog: '#0f2a4a', with: '#2453c7', up: '#8a97a8' };
export const KORD: K[] = ['done', 'you', 'prog', 'with', 'up'];

/* ---------------- per-step helpers ---------------- */

/** KD: the real kind on the phase / step pages ("Next" is a landing-table label only). */
export function kd(s: PortalStep): K {
  return s.kind === 'next' ? 'up' : s.kind;
}
/** Landing table kind (lkind). */
export function lkind(s: PortalStep): LK {
  return s.kind;
}
/** Glyph: late steps (not done, past their window) show the red ×. */
export function glyph(s: PortalStep, k: LK = kd(s)): GlyphKind {
  if (s.late && k !== 'done') return 'late';
  return k === 'next' ? 'up' : k;
}
export function ownKey(s: PortalStep): OwnKey {
  return s.owner === 'client' ? 'You' : s.owner === 'mca' ? 'MCA' : 'SBC';
}
export function stepHrefOf(s: PortalStep): string {
  return clientIncorporationStepPath(s.item);
}

export function dateCell(s: PortalStep, coiExpected?: string): string {
  const k = kd(s);
  if (k === 'done') return s.doneOn ? `Done ${fmt(s.doneOn)}` : 'Done';
  if (k === 'you' || k === 'prog') return s.due ? `Due ${fmt(s.due)}` : '—';
  if (k === 'with') return s.since ? `since ${fmt(s.since)}` : s.due ? `Due ${fmt(s.due)}` : '—';
  if (s.id === 'pre-12' && coiExpected) return `exp. ${fmt(coiExpected)}`;
  // Gated steps that already have a planned window show it (as the rail's "Opens later · due …").
  return s.due ? `Due ${fmt(s.due)}` : '—';
}

export function tipTxt(s: PortalStep, k: LK = kd(s)): string {
  const parts: string[] = [KL[k]];
  if (k === 'done') {
    if (s.doneOn) parts.push(fmt(s.doneOn));
  } else if (k === 'with') {
    if (s.since) parts.push(`since ${fmt(s.since)}`);
    if (s.due) parts.push(`due ${fmt(s.due)}`);
  } else if (k === 'up' || k === 'next') {
    if (s.due) parts.push(`planned ${fmt(s.due)}`);
  } else if (s.due) parts.push(`due ${fmt(s.due)}`);
  if (s.late && k !== 'done') parts.push(`late by ${s.lateDays} day${s.lateDays === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function railSub(s: PortalStep, short: string): string {
  const k = kd(s);
  if (k === 'done') return s.doneOn ? `Done · ${fmt(s.doneOn)}` : 'Done';
  if (k === 'you') return `Waiting on ${short}${s.due ? ` · due ${fmt(s.due)}` : ''}`;
  if (k === 'prog') return `In progress${s.due ? ` · due ${fmt(s.due)}` : ''}`;
  if (k === 'with') return `With ${short}’s project lead${s.since ? ` · since ${fmt(s.since)}` : ''}`;
  return s.due ? `Opens later · due ${fmt(s.due)}` : 'Opens later';
}

/** Prototype `short()`: a label cut to ~22 characters. */
export function shortLabel(l: string): string {
  const t = String(l).replace(/\s*\(.*$/, '').replace(/,.*$/, '').replace(/\s+—.*$/, '');
  return t.length > 22 ? `${t.slice(0, 20).replace(/\s+\S*$/, '')}…` : t;
}

export interface SubStep {
  l: string;
  s: 'done' | 'now' | 'todo';
}

/** Sub-steps of a step: its field sections (or fields) with the filled state from the real answers. */
export function subList(s: PortalStep): SubStep[] {
  const fields = filterFieldsByViewer(getClientResponseFields(s.item), 'client').filter((f) => !isStepRemarksField(f));
  const responses = (s.slice?.responses ?? {}) as Record<string, string>;
  const filled = (id: string) => String(responses[id] ?? '').trim().length > 0;
  let groups: Array<{ l: string; ids: string[] }> = [];
  const sections = [...new Set(fields.map((f) => f.section).filter(Boolean))] as string[];
  if (sections.length >= 2) {
    groups = sections.map((sec) => ({ l: shortLabel(sec), ids: fields.filter((f) => f.section === sec).map((f) => f.id) }));
  } else if (fields.length >= 2 && fields.length <= 8) {
    groups = fields.map((f) => ({ l: shortLabel(f.label), ids: [f.id] }));
  } else if (s.item.infoRequired.length) {
    groups = s.item.infoRequired.slice(0, 8).map((q) => ({ l: shortLabel(q.split(' — ')[0] ?? q), ids: [] }));
  } else groups = [{ l: shortLabel(s.title), ids: [] }];
  const k = kd(s);
  if (k === 'done') return groups.map((g) => ({ l: g.l, s: 'done' }));
  if (k === 'up') return groups.map((g) => ({ l: g.l, s: 'todo' }));
  let now = false;
  return groups.map((g) => {
    const done = g.ids.length > 0 && g.ids.some(filled);
    if (done) return { l: g.l, s: 'done' };
    if (!now) {
      now = true;
      return { l: g.l, s: 'now' };
    }
    return { l: g.l, s: 'todo' };
  });
}

/* ---------------- drill helpers (rule 14) ---------------- */

export function stRow(s: PortalStep, coi?: string): DrillRow {
  const k = kd(s);
  return { title: `${s.n} · ${s.title}`, meta: dateCell(s, coi), chip: KL[k], chipColor: KCOL[k], href: stepHrefOf(s) };
}

export function tabsFor(list: PortalStep[], coi?: string): Array<DrillTab & { k: K }> {
  return KORD.map((k) => ({
    k,
    label: KL[k],
    color: KCOL[k],
    rows: list.filter((x) => kd(x) === k).map((x) => stRow(x, coi)),
  })).filter((t) => t.rows.length);
}

export function idx(tabs: Array<{ k: string }>, k: string): number {
  const i = tabs.findIndex((t) => t.k === k);
  return i < 0 ? 0 : i;
}

/* ---------------- phases ---------------- */

export function phState(p: PortalPhase): 'done' | 'up' | 'active' {
  return p.state;
}
export function phKind(p: PortalPhase): GlyphKind {
  return p.state === 'done' ? 'done' : p.state === 'up' ? 'up' : 'prog';
}
/** Latest done date in the phase (prototype `phEnd` for done phases). */
export function phDoneEnd(p: PortalPhase): string | undefined {
  return p.steps.map((s) => s.doneOn).filter(Boolean).sort().at(-1) as string | undefined;
}

/**
 * Plan window of a phase. Part A / B: the manager's windows (the incorporation
 * window, or per-step windows when set). Post-inc. / Registration: from the
 * COI to the latest step date in the phase (DECISIONS).
 */
export function phPlan(p: PortalPhase, coi?: string): [string, string] | null {
  if (p.no === 1) {
    // Part A is judged against its own plan (the latest own step window in
    // the phase), not the whole incorporation window ending at the COI (TL-05).
    const own = p.steps.filter((s) => s.ownWindow && s.due);
    if (own.length) {
      const from = own.map((s) => s.windowFrom ?? s.due!).sort()[0]!;
      const to = own.map((s) => s.due!).sort().at(-1)!;
      return [from, to];
    }
  }
  if (p.no <= 2) {
    if (p.start && p.end) return [p.start, p.end];
    return null;
  }
  const dates = p.steps.map((s) => s.due ?? s.doneOn).filter(Boolean).sort() as string[];
  const end = dates.at(-1);
  const start = coi ?? p.start;
  if (!start) return null;
  // No step dates yet: a fixed planned stretch after the COI (prototype's hatched bar).
  if (!end) return [start, addDays(start, p.no === 3 ? 30 : 45)];
  return start <= end ? [start, end] : [end, start];
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/* ---------------- What's this? answers (OV-05) ---------------- */

export function stepAnswer(s: PortalStep, short: string): WhatsThisAnswer {
  const forms = s.item.forms ?? [];
  return {
    title: s.title,
    text: s.item.description ?? s.item.infoRequired.join(' · '),
    why:
      s.owner === 'client'
        ? `${short} owns this step: ${short}’s answers and documents go into the ${forms[0] || 'filing'}.`
        : 'SBC does this step for you; you see the result and approve it.',
    source: `${forms.length ? `${forms.join(', ')} · ` : ''}VCFO Suite checklist, step ${s.n}`,
    href: stepHrefOf(s),
  };
}

export function phaseAnswer(p: PortalPhase, short: string, href: string): WhatsThisAnswer {
  const i = p.no - 1;
  const first = p.steps[0]?.n;
  const last = p.steps.at(-1)?.n;
  return {
    title: `Phase ${p.no} · ${PH[i]}`,
    text: phInfo(short)[i]!,
    why: phWhy(short)[i],
    source: `${PH_SRC[i]} · VCFO Suite checklist, steps ${first}–${last}`,
    href,
    goLabel: 'Open this phase',
  };
}

/* ---------------- the hook ---------------- */

async function fetchExtras(): Promise<ClientIncorporationExtras | null> {
  const res = await fetch('/api/client/incorporation', { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`incorporation ${res.status}`);
  return ((await res.json()) as { incorporation: ClientIncorporationExtras }).incorporation;
}

export const INC_EXTRAS_KEY = ['client-portal', 'incorporation'] as const;

export interface IncData {
  model: PortalIncorporationModel;
  engagementId?: string;
  companyName: string;
  short: string;
  today: string;
  /** Real COI date (yyyy-mm-dd) once incorporated. */
  coiDate?: string;
  /** Manager-set incorporation window end. */
  coiExpected?: string;
  incorporated: boolean;
  extras?: ClientIncorporationExtras | null;
  leadName?: string;
  managerName?: string;
  identifiers: { cin?: string; pan?: string; tan?: string };
  certificate?: { storagePath: string; name: string };
  ownershipType?: import('@/data/engagements').OwnershipType;
  pending: boolean;
  noEngagement: boolean;
  requestsFor: (stepId: string) => ClientFileRequestDto[];
  refresh: () => void;
}

export function shortCompany(name?: string): string {
  if (!name) return 'Your company';
  return companyShortName(name) || name;
}

export function useIncData(): IncData {
  const { shell } = usePortal();
  const { refreshEngagementChecklist, engagementsSettled } = useApp();
  const { model, engagement, loading } = usePortalIncorporation();
  const ov = useClientOverview();
  const extrasQ = useQuery({
    queryKey: INC_EXTRAS_KEY,
    queryFn: fetchExtras,
    enabled: Boolean(engagement),
    staleTime: 30_000,
  });
  const engId = engagement?.id;
  useEffect(() => {
    if (engId) void refreshEngagementChecklist(engId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engId]);

  const overview = ov.data?.overview ?? null;
  const today = todayIST();
  const coiDate = overview?.engagement.incorporationDate?.slice(0, 10) ?? engagement?.incorporationDate?.slice(0, 10) ?? model.byId['pre-12']?.doneOn;
  const requests = extrasQ.data?.fileRequests;
  const requestsFor = useMemo(() => {
    const by = new Map<string, ClientFileRequestDto[]>();
    for (const r of requests ?? []) by.set(r.stepId, [...(by.get(r.stepId) ?? []), r]);
    return (id: string) => by.get(id) ?? [];
  }, [requests]);
  const team = overview?.team ?? [];
  const cert = overview?.documents.deliverables.find((d) => d.kind === 'certificate');

  return {
    model,
    engagementId: engId,
    companyName: engagement?.companyName ?? overview?.engagement.companyName ?? '',
    short: shell?.companyShort || shortCompany(engagement?.companyName),
    today,
    coiDate,
    coiExpected: model.coiExpected,
    incorporated: Boolean(overview?.incorporated || coiDate),
    extras: extrasQ.data,
    leadName: team.find((t) => t.role === 'Project Lead')?.name,
    managerName: team.find((t) => t.role === 'Project Manager')?.name,
    identifiers: { cin: overview?.identifiers.cin, pan: overview?.identifiers.pan, tan: overview?.identifiers.tan },
    certificate: cert ? { storagePath: cert.storagePath, name: cert.name } : undefined,
    ownershipType: engagement?.ownershipType,
    pending: loading || (!engagement && !engagementsSettled) || (Boolean(engagement) && ov.isPending),
    noEngagement: !loading && engagementsSettled && !engagement,
    requestsFor,
    refresh: () => {
      if (engId) void refreshEngagementChecklist(engId);
      void extrasQ.refetch();
      void ov.refetch();
    },
  };
}

/** First name ("Arjun") for "requested by Arjun". */
export function firstName(n?: string): string {
  return (n ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Signed URL for a milestone document path (`/api/milestone-documents/signed-url`). */
export async function signedUrlFor(path: string): Promise<string> {
  const res = await fetch(`/api/milestone-documents/signed-url?path=${encodeURIComponent(path)}`);
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? 'Could not open the file');
  return body.url;
}
