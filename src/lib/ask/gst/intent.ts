/**
 * Whether a chat message asks Ask VCFO to work on a client's GST registration, and which part:
 *
 *   "do GST registration for Kestrel", "register Kestrel for GST", "file REG-01 for Kestrel",
 *   "is Kestrel ready for GST registration?"                         -> readiness
 *   "fetch the GST papers for Kestrel from SharePoint"               -> fetch_sharepoint
 *   "ask Kestrel for the GST registration details"                   -> ask_client
 *   "start Kestrel on the GST portal"                                -> start_portal
 *
 * A question about GST in general ("what is GST registration?", "how long does GST registration
 * take?") is not a request; the knowledge path answers it. Pure, so the pipeline and the tests read
 * one answer. The company words are read here and matched to a project by the caller.
 */

export type GstIntentKind = 'readiness' | 'fetch_sharepoint' | 'ask_client' | 'start_portal';

export interface GstIntent {
  kind: GstIntentKind;
  /** The company as typed ("Kestrel", "kestrel labs pvt ltd"); null when the message names none. */
  company: string | null;
}

const normal = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const GST = /\b(gst|gstin|reg[\s-]?0?1)\b/;
const GENERAL_QUESTION = /^(what|why|how|when|who|which|explain|tell me about|define)\b/;
const READY_QUESTION = /^(is|are|can)\b.*\bready\b/;
const COMPANY_TAIL = /(?:\s+(?:on|in|into|from|via|using)\s+(?:the\s+)?(?:gst\s+portal|portal|sharepoint|share\s*point|suite|tool|app))+\s*[.!?]*$/;

function tidyCompany(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw
    .replace(COMPANY_TAIL, '')
    .replace(/'s$/, '')
    .replace(/^(the\s+)?(client|company)\s+/, '')
    .replace(/[.!?,;:]+$/, '')
    .trim();
  if (!t || /^(it|this|them|this client|this company|the client|the company|him|her|us|me)$/.test(t)) return null;
  if (t.split(' ').length > 8) return null;
  return t;
}

/** The company words of the message, or null. */
export function companyFromGstMessage(text: string): string | null {
  const t = normal(text);
  const patterns: RegExp[] = [
    // "register Kestrel for GST", "register Kestrel Labs under GST"
    /\bregister\s+(.+?)\s+(?:for|under|with|on)\s+(?:the\s+)?gst\b/,
    // "ask Kestrel for the GST details"
    /\bask\s+(.+?)\s+(?:for|to send|to share|about)\s+(?:the\s+|their\s+|its\s+)?(?:gst|details|papers|documents)/,
    // "start Kestrel on the GST portal"
    /\bstart\s+(.+?)\s+on\s+(?:the\s+)?gst\b/,
    // "... for Kestrel", "... of Kestrel"
    /\b(?:for|of)\s+(?!gst\b|the gst\b|reg)(.+?)(?:\s+from\s+(?:the\s+)?share\s*point.*)?[.!?]*$/,
    // "is Kestrel ready for GST registration?"
    /^(?:is|are|can)\s+(.+?)\s+(?:ready|be registered)\b/,
    // "Kestrel's GST registration"
    /^(?:do\s+|start\s+|file\s+)?(.+?)'s\s+gst\b/,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    const name = tidyCompany(m?.[1]);
    if (name && !GST.test(name)) return name;
  }
  return null;
}

export function gstIntent(text: string): GstIntent | null {
  const t = normal(text);
  if (!t || t.length > 240 || !GST.test(t)) return null;
  const registration = /\b(registration|register|registering|reg[\s-]?0?1|apply|application|new gstin|gstin for)\b/.test(t);
  if (!registration) return null;
  if (GENERAL_QUESTION.test(t)) return null;
  const company = companyFromGstMessage(text);
  if (/\bshare\s*point\b/.test(t) && /\b(fetch|get|read|take|pull|bring)\b/.test(t)) return { kind: 'fetch_sharepoint', company };
  if (/^(please\s+)?(ask|request|send)\b/.test(t) && /\b(details|papers|documents|request list|information|info)\b/.test(t)) return { kind: 'ask_client', company };
  if (/\bgst portal\b/.test(t) && /\b(start|open|fill|begin|launch)\b/.test(t)) return { kind: 'start_portal', company };
  if (READY_QUESTION.test(t)) return { kind: 'readiness', company };
  const asks = /^(please\s+)?(do|start|begin|file|prepare|register|apply|get|need to do|let's do|lets do|can you do|could you do|kick off|initiate)\b/.test(t) || /^gst registration (for|of)\b/.test(t) || /\bregister\s+.+\s+for\s+gst\b/.test(t);
  return asks ? { kind: 'readiness', company } : null;
}

/** The chat messages the card's buttons send, which `gstIntent` reads back. */
export function gstButtonMessage(kind: Exclude<GstIntentKind, 'readiness'>, companyName: string): string {
  if (kind === 'fetch_sharepoint') return `Fetch the GST registration papers for ${companyName} from SharePoint`;
  if (kind === 'ask_client') return `Ask ${companyName} for the GST registration details`;
  return `Start ${companyName} on the GST portal for registration`;
}
