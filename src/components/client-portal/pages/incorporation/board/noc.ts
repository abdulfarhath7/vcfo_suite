/**
 * Board resolution (NOC), rule R-52: the pure parts of the client page. The NOC is the parent's
 * Pre-2 board resolution, one document in three variants (`src/lib/noc/templates.ts`). The track,
 * the to-do list and the evidence rows come from the shared board document part
 * (`@/components/board-doc`) and the NOC state route (`docs/ui-port/BR-NOC-API.md`); this file
 * only joins them to the page's existing board-resolution data.
 */
import { coerceOwnershipType } from '@/data/engagements';
import { NOC_TEMPLATES } from '@/lib/noc/templates';
import { resolveNocVariant, type NocVariant } from '@/lib/noc/variant';
import type { NocAnswers } from '@/lib/noc/receive';
import type { NocState } from '@/lib/noc/state';
import { NOC_STAGE_KEYS, UPLOADED_KEY, type DocStageRecords } from '@/components/board-doc';

/** The subtitle under the title: the variant name, or what is still missing. */
export function nocVariantLabel(noc: Pick<NocState, 'variantLabel'> | null | undefined, answers: NocAnswers): string {
  if (noc?.variantLabel) return noc.variantLabel;
  const v = resolveNocVariant(answers);
  if (v) return NOC_TEMPLATES[v].label;
  return coerceOwnershipType(answers.ownershipType) === 'independent' ? 'No NOC · standalone company' : 'NOC · parent’s role not chosen yet';
}

/** The variant the track follows: the route's (staff override wins there), else the answers. */
export function nocTrackVariant(noc: Pick<NocState, 'variant'> | null | undefined, answers: NocAnswers): NocVariant | null {
  return noc?.variant ?? resolveNocVariant(answers);
}

/** A done step with no stored date: `docDay` prints nothing for it. */
const NO_DATE = ' ';

/** Dates and names the page already reads when the NOC route has nothing (older builds). */
export interface NocFallback {
  drafted?: string;
  released?: string;
  releasedBy?: string;
  signed?: string;
  signedBy?: string;
  accepted?: string;
  acceptedBy?: string;
  /** The draft is finalized and on file (counts as drafted without a date). */
  onFile?: boolean;
}

/**
 * The stage records for `DocTrack` and `todoStates`. Every date comes from one record (P2): the
 * NOC route's track when it answers, else the board-resolution row the page already reads. The
 * fallback has no notary or apostille record, so those steps stay open until the route has them.
 */
export function nocRecords(noc: Pick<NocState, 'track'> | null | undefined, fb: NocFallback): DocStageRecords {
  const out: DocStageRecords = {};
  if (noc?.track?.length) {
    // A done step without a date keeps a blank `at`: it counts as done and shows no date.
    for (const s of noc.track) if (s.done) out[s.key] = { at: s.at || NO_DATE, by: s.byName ?? null };
  } else {
    const k = NOC_STAGE_KEYS;
    if (fb.drafted || fb.onFile || fb.released) out[k.drafted] = { at: fb.drafted ?? fb.released ?? NO_DATE, by: 'SBC' };
    if (fb.released) out[k.released] = { at: fb.released, by: fb.releasedBy || 'SBC' };
    if (fb.signed) out[k.signed] = { at: fb.signed, by: fb.signedBy ?? null };
    if (fb.accepted) out[k.accepted] = { at: fb.accepted, by: fb.acceptedBy ?? null };
  }
  const signed = out[NOC_STAGE_KEYS.signed];
  if (signed?.at) out[UPLOADED_KEY] = signed;
  return out;
}

export type NocPhase = 'drafting' | 'released' | 'sent' | 'accepted';

export function nocPhase(records: DocStageRecords): NocPhase {
  const k = NOC_STAGE_KEYS;
  if (records[k.accepted]?.at) return 'accepted';
  if (records[k.signed]?.at) return 'sent';
  if (records[k.released]?.at) return 'released';
  return 'drafting';
}

/** C4: one main button. Released: download. Scan sent: upload (replace). Accepted or drafting: none. */
export function nocMainAction(phase: NocPhase): { kind: 'download' | 'upload'; label: string } | null {
  if (phase === 'released') return { kind: 'download', label: 'Download the Word file' };
  if (phase === 'sent') return { kind: 'upload', label: 'Upload signed copy' };
  return null;
}

/** A value still holding its template placeholder ("[Designation]", "____") is not known yet. */
export function known(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return t && !/^\[.*\]$/.test(t) && !/^_+$/.test(t) ? t : '';
}

/** The friendly download name. The client never sees the internal file name (P5). */
export const NOC_CLIENT_FILENAME = 'Board resolution (NOC).docx';
