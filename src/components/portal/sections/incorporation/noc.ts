/**
 * Board resolution (NOC) in the client portal: the pure parts of BoardStage.
 *
 * The NOC state comes from `GET /api/engagements/:id/board-resolution/noc`
 * (docs/ui-port/BR-NOC-API.md): the variant, a track of 6 steps (foreign
 * parent) or 4 (Indian parent, or the notary steps turned off), the send back
 * and the latest version number. A client response never carries the staff
 * block, so nothing here can leak a receive check or an internal file name.
 *
 * When the route has nothing yet (an older deploy, or before the first draft),
 * the rows fall back to the dates the stage already reads from the board
 * resolution row and step 3 — the same rule as the previous portal's
 * `board/noc.ts`.
 */
import { coerceOwnershipType } from '@/data/engagements';
import { NOC_STEP_LABEL, nocTrackKeys, type NocAnswers, type NocStepKey } from '@/lib/noc/receive';
import type { NocState, NocTrackStep } from '@/lib/noc/state';
import { NOC_TEMPLATES } from '@/lib/noc/templates';
import { resolveNocVariant } from '@/lib/noc/variant';

export type NocPhase = 'drafting' | 'released' | 'sent' | 'sent_back' | 'accepted';

/** Dates (already formatted, "14 Oct") and names the stage reads without the NOC route. */
export interface NocFallback {
  drafted?: string;
  released?: string;
  signed?: string;
  signedBy?: string;
  accepted?: string;
  acceptedBy?: string;
  /** The draft is finalized and on file: counts as drafted and released. */
  onFile?: boolean;
}

export interface NocStageRow {
  key: NocStepKey;
  label: string;
  /** Who and when for a done step; what happens next for an open one. */
  sub: string;
  done: boolean;
  /** The first open step. */
  now: boolean;
}

/** What each open step waits for, in the client's words. */
const OPEN_HINT: Record<NocStepKey, string> = {
  drafted: 'SBC drafts it from your details in step 1',
  released: 'SBC releases it here to sign',
  signed: 'Print on letterhead, a director signs, upload it',
  notarised: 'A notary stamps the signed copy',
  apostilled: 'The apostille certificate is attached',
  accepted: 'SBC checks the signed copy',
};

/** The subject of a done step when the record names nobody. */
const DONE_BY: Record<NocStepKey, string> = {
  drafted: 'SBC',
  released: 'SBC',
  signed: '',
  notarised: 'SBC',
  apostilled: 'SBC',
  accepted: 'SBC',
};

function doneLine(key: NocStepKey, by: string | undefined, day: string | undefined, company: string): string {
  const who = (by ?? '').trim() || (key === 'signed' ? company : DONE_BY[key]);
  return [who, day].filter(Boolean).join(' · ');
}

/**
 * The track rows. With the route's track every row comes from one stored
 * record (done, who, when); the first step not done is "now". Without it the
 * four Indian steps are built from the fallback dates.
 */
export function nocStageRows(
  noc: Pick<NocState, 'track'> | null | undefined,
  fb: NocFallback,
  opts: { company: string; day: (ts?: string | null) => string | undefined; firstName?: (n?: string | null) => string },
): NocStageRow[] {
  const first = opts.firstName ?? ((n) => (n ?? '').trim());
  let steps: Array<Pick<NocTrackStep, 'key' | 'done'> & { by?: string; when?: string }>;
  if (noc?.track?.length) {
    steps = noc.track.map((s) => ({ key: s.key, done: s.done, by: s.byName ? first(s.byName) : undefined, when: opts.day(s.at) }));
  } else {
    const drafted = Boolean(fb.drafted || fb.onFile || fb.released);
    const released = Boolean(fb.released || fb.onFile);
    const signed = Boolean(fb.signed || fb.accepted);
    const accepted = Boolean(fb.accepted);
    const byKey: Record<NocStepKey, { done: boolean; by?: string; when?: string }> = {
      drafted: { done: drafted, when: fb.drafted },
      released: { done: released, when: fb.released },
      signed: { done: signed, by: fb.signedBy ? first(fb.signedBy) : undefined, when: fb.signed },
      notarised: { done: false },
      apostilled: { done: false },
      accepted: { done: accepted, by: fb.acceptedBy ? first(fb.acceptedBy) : undefined, when: fb.accepted },
    };
    steps = nocTrackKeys(false).map((key) => ({ key, ...byKey[key] }));
  }
  let nowSet = false;
  return steps.map((s) => {
    const now = !s.done && !nowSet;
    if (now) nowSet = true;
    return {
      key: s.key,
      label: NOC_STEP_LABEL[s.key],
      sub: s.done ? doneLine(s.key, s.by, s.when, opts.company) : OPEN_HINT[s.key],
      done: s.done,
      now,
    };
  });
}

/** Where the document stands, from the rows and the send back. */
export function nocPhase(rows: readonly NocStageRow[], sentBack: boolean): NocPhase {
  const done = (k: NocStepKey) => rows.some((r) => r.key === k && r.done);
  if (done('accepted')) return 'accepted';
  if (sentBack) return 'sent_back';
  if (done('signed')) return 'sent';
  if (done('released')) return 'released';
  return 'drafting';
}

export interface NocStatus {
  /** A prototype pill class. */
  kind: 'ok' | 'up' | 'due' | 'over';
  icon: 'check' | 'clock' | 'alert';
  text: string;
}

/** The status words in the stage head. Nothing before release. */
export function nocStatus(phase: NocPhase, rows: readonly NocStageRow[], sentBackDay?: string): NocStatus | null {
  const when = (k: NocStepKey) => {
    const r = rows.find((x) => x.key === k && x.done);
    const m = r ? /(\d{1,2} [A-Z][a-z]{2}(?: \d{4})?)$/.exec(r.sub) : null;
    return m ? ` ${m[1]}` : '';
  };
  switch (phase) {
    case 'accepted':
      return { kind: 'ok', icon: 'check', text: `Accepted${when('accepted')}` };
    case 'sent_back':
      return { kind: 'over', icon: 'alert', text: `Sent back${sentBackDay ? ` ${sentBackDay}` : ''}` };
    case 'sent':
      return { kind: 'up', icon: 'clock', text: `Signed copy sent${when('signed')}` };
    case 'released':
      return { kind: 'due', icon: 'clock', text: 'Waiting for the signed copy' };
    default:
      return null;
  }
}

/** The client may upload (or replace) the signed copy from release until SBC accepts it. */
export function canUploadSigned(phase: NocPhase): boolean {
  return phase === 'released' || phase === 'sent' || phase === 'sent_back';
}

/** The chip on the signed-copy file row. */
export function signedCopyChip(phase: NocPhase): { kind: 'done' | 'over' | 'up'; text: string } {
  if (phase === 'accepted') return { kind: 'done', text: 'Accepted' };
  if (phase === 'sent_back') return { kind: 'over', text: 'Sent back' };
  return { kind: 'up', text: 'Sent' };
}

/** The variant under the title: the route's label, else the answers, else what is still missing. */
export function nocVariantLabel(noc: Pick<NocState, 'variantLabel'> | null | undefined, answers: NocAnswers): string {
  if (noc?.variantLabel) return noc.variantLabel;
  const v = resolveNocVariant(answers);
  if (v) return NOC_TEMPLATES[v].label;
  return coerceOwnershipType(answers.ownershipType) === 'independent' ? 'No NOC · standalone company' : 'NOC · parent’s role not chosen yet';
}
