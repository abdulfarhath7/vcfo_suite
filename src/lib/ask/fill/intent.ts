import { getActiveCatalogItems, getIncorporationPhases } from '@/data/checklist';
import type { FillMode, FillScope } from './types';

/**
 * Whether a chat message asks to fill the app: "fill this into the app", "upload the data into vcfo
 * suite tool", "save it in SPICe", "fill it", and (since the fill-everything build) any message that
 * starts by asking to fill, with or without a place, a field, a source or a client: "fill
 * business description from br", "fill bonterra", "fill everything", "fill data". Every such request
 * starts the whole fill; an optional scope ("fill phase 2") still narrows it. Pure, so the pipeline
 * and the tests read one answer. A question about filling ("how do I fill step 3?") is not a request,
 * and neither is a sentence that only mentions filling ("the client will fill it tomorrow").
 */

const VERB = /\b(fill|fil|upload|put|save|enter|push|load|apply|write)\b/;
const PLACE = /\b(in|into|onto|on|to)\s+(the\s+|our\s+)?(app|application|tool|system|portal|software|vcfo(\s*suite)?(\s+(tool|app))?|suite|spice\s*\+?|spice\s*plus|checklist|steps?|project)\b/;
/** How a short request may say the mode: "fill it automatically", "fill it in manually". */
const HOW = '(\\s+(auto|automatically|manually|manual|live|for\\s+me|step\\s+by\\s+step|in\\s+(the\\s+)?background|by\\s+itself))?';
const SHORT = new RegExp(`^(please\\s+)?(fill|fill\\s+(it|this|them|these|that)(\\s+(in|up|out))?|fill\\s+in|go\\s+ahead\\s+and\\s+fill(\\s+it)?)${HOW}(\\s+(now|please))?[.!]*$`);
const QUESTION = /^(how|what|why|when|where|which|who|is|are|does|did|can\s+i|should\s+i|do\s+i)\b/;
/**
 * A request that opens with the fill verb itself, after polite or filler words: "fill bonterra",
 * "please fill everything", "can you fill the business description from the br", "auto fill data".
 */
const LEADING_FILL = /^((please|pls|plz|kindly|ok|okay|now|just|also|then|and|go\s+ahead\s+and|can\s+you|could\s+you|would\s+you|will\s+you)[\s,]+)*(auto[\s-]?)?(fill|fil|populate|prefill|pre-fill)\b/;

const normal = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export function isFillRequest(text: string): boolean {
  const t = normal(text);
  if (!t || t.length > 240) return false;
  if (SHORT.test(t)) return true;
  if (QUESTION.test(t)) return false;
  if (LEADING_FILL.test(t)) return true;
  return VERB.test(t) && PLACE.test(t);
}

/** A mode the message itself names, which wins over the composer chip; null when it names none. */
export function modeFromText(text: string): FillMode | null {
  const t = normal(text);
  if (/\b(auto|automatic|automatically|in (the )?background|by itself|on its own|without me)\b/.test(t)) return 'auto';
  if (/\b(live|manual|manually|in front of me|step by step|let me watch|show me)\b/.test(t)) return 'manual';
  return null;
}

/**
 * Whether a message also asks to fetch a client's files: "fetch bonterra data", "pull the folder",
 * "take Kestrel's documents from SharePoint". Used only when a fill request finds no open card, so
 * the folder is read first and the fill follows on the card it makes.
 */
const FETCH_VERB = /\b(fetch|pull|get|take|bring|grab|import|download)\b/;
const FETCH_SOURCE = /\b(data|details|folder|files?|documents?|docs|papers|sharepoint|share point)\b/;

export function asksToFetch(text: string): boolean {
  const t = normal(text);
  if (!t || QUESTION.test(t)) return false;
  return /\bshare\s?point\b/.test(t) || (FETCH_VERB.test(t) && FETCH_SOURCE.test(t));
}

/** Phases by the words people use for them, as indexes into `getIncorporationPhases()`. */
const PHASE_WORDS: ReadonlyArray<{ pattern: RegExp; phases: number[] }> = [
  { pattern: /\bname\s+(application|reservation|approval)\b/, phases: [0] },
  { pattern: /\bpost[\s-]?inc(orporation)?\b/, phases: [2] },
  { pattern: /\bpre[\s-]?inc(orporation)?\b/, phases: [0, 1] },
  { pattern: /\bincorporation\b/, phases: [1] },
  { pattern: /\bregistrations?\b/, phases: [3] },
];

const STEP_NUMBER = /\bsteps?\s+(\d{1,2})(?:\s*(?:-|–|to|and|through)\s*(\d{1,2}))?\b/;

/**
 * The steps a fill request names, so only those steps run: "name application" is Phase 1,
 * "incorporation" Phase 2, "post-incorporation" Phase 3, "registration" Phase 4, "phase 2" by
 * number, and "step 3" (or "steps 2 to 4") counted within the phase named, or along the whole
 * checklist when no phase is named. Null when the message names no step, so every step runs.
 */
export function scopeFromText(text: string): FillScope | null {
  const t = normal(text);
  if (!t) return null;
  const phases = getIncorporationPhases();
  let picked: number[] = [];
  const byNumber = /\bphase\s*([1-9])\b/.exec(t);
  if (byNumber && Number(byNumber[1]) <= phases.length) picked = [Number(byNumber[1]) - 1];
  else {
    // "post-incorporation" also holds "incorporation", so the words are tried in order and the
    // first match wins.
    const word = PHASE_WORDS.find((w) => w.pattern.test(t));
    if (word) picked = word.phases.filter((i) => i < phases.length);
  }
  const inPhases = picked.map((i) => phases[i]!);
  const items = inPhases.length > 0 ? inPhases.flatMap((p) => p.items) : getActiveCatalogItems();
  const step = STEP_NUMBER.exec(t);
  if (step) {
    const from = Number(step[1]);
    const to = step[2] ? Number(step[2]) : from;
    const chosen = items.slice(Math.max(0, Math.min(from, to) - 1), Math.max(from, to));
    if (chosen.length === 0) return null;
    const where = inPhases.length === 1 ? ` of ${inPhases[0]!.title}` : '';
    const label = chosen.length === 1 ? `step ${from}${where} (${chosen[0]!.title})` : `steps ${Math.min(from, to)} to ${Math.max(from, to)}${where}`;
    return { stepIds: chosen.map((i) => i.id), label };
  }
  if (inPhases.length === 0) return null;
  return { stepIds: items.map((i) => i.id), label: inPhases.map((p) => p.title).join(' and ') };
}

/** How long a card in the chat counts as the read a fill request means; older cards are read again. */
export const FRESH_CARD_MS = 30 * 60 * 1000;

/**
 * Whether a fill request should fill the open card in the chat as it is, or read every source again
 * first. The card is used when it is recent and for the client the message names (or no client is
 * named). Otherwise the client's folder and documents are read again: a reread reuses every stored
 * read of an unchanged file, so it costs little, and the new card holds everything known.
 */
export function cardIsFresh(card: { createdAt: Date; engagementId: string | null }, input: { now: Date; namedEngagementIds: readonly string[] }): boolean {
  if (input.now.getTime() - card.createdAt.getTime() > FRESH_CARD_MS) return false;
  if (input.namedEngagementIds.length === 0) return true;
  return Boolean(card.engagementId && input.namedEngagementIds.includes(card.engagementId));
}
