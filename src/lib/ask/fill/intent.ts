import type { FillMode } from './types';

/**
 * Whether a chat message asks to put a card's values into the app: "fill this into the app",
 * "upload the data into vcfo suite tool", "save it in SPICe", "fill it". Pure, so the pipeline and
 * the tests read one answer. A question about filling ("how do I fill step 3?") is not a request.
 */

const VERB = /\b(fill|fil|upload|put|save|enter|push|load|apply|write)\b/;
const PLACE = /\b(in|into|onto|on|to)\s+(the\s+|our\s+)?(app|application|tool|system|portal|software|vcfo(\s*suite)?(\s+(tool|app))?|suite|spice\s*\+?|spice\s*plus|checklist|steps?|project)\b/;
/** How a short request may say the mode: "fill it automatically", "fill it in manually". */
const HOW = '(\\s+(auto|automatically|manually|manual|live|for\\s+me|step\\s+by\\s+step|in\\s+(the\\s+)?background|by\\s+itself))?';
const SHORT = new RegExp(`^(please\\s+)?(fill|fill\\s+(it|this|them|these|that)(\\s+(in|up|out))?|fill\\s+in|go\\s+ahead\\s+and\\s+fill(\\s+it)?)${HOW}(\\s+(now|please))?[.!]*$`);
const QUESTION = /^(how|what|why|when|where|which|can\s+i|should\s+i|do\s+i)\b/;

const normal = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export function isFillRequest(text: string): boolean {
  const t = normal(text);
  if (!t || t.length > 240) return false;
  if (SHORT.test(t)) return true;
  if (QUESTION.test(t)) return false;
  return VERB.test(t) && PLACE.test(t);
}

/** A mode the message itself names, which wins over the composer chip; null when it names none. */
export function modeFromText(text: string): FillMode | null {
  const t = normal(text);
  if (/\b(auto|automatic|automatically|in (the )?background|by itself|on its own|without me)\b/.test(t)) return 'auto';
  if (/\b(live|manual|manually|in front of me|step by step|let me watch|show me)\b/.test(t)) return 'manual';
  return null;
}
