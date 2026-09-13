import {
  NOTIFY_EVENTS,
  type NotifyEvent,
  type NotifyVariables,
} from '@/lib/notify/types';

/**
 * Event → template reference + ordered variables, for both providers.
 *
 * `orderedVariables` is the single source of truth for what each message says
 * and in what order. The two providers only differ in serialisation:
 *   - Twilio Content API: `contentVariables`, a JSON object keyed by position
 *   - Meta Cloud API (AWS EUM): a `components` array of typed parameters
 * Both are built from the same ordered values, so a template body can never
 * drift between transports.
 *
 * No body text lives in this file. If a template is not configured for an
 * event, the send is skipped with `no_template` — never substituted with a
 * free-form message.
 */

/** `welcome` → WHATSAPP_TEMPLATE_WELCOME */
export function templateEnvKey(event: NotifyEvent): string {
  return `WHATSAPP_TEMPLATE_${event.toUpperCase()}`;
}

export type TemplateSidMap = Partial<Record<NotifyEvent, string>>;

/**
 * `welcome` → WHATSAPP_TEMPLATE_NAME_WELCOME.
 *
 * Deliberately NOT the same key as the Twilio SID: a deployment keeping Twilio
 * as a fallback has both configured at once, and one key cannot hold a Content
 * SID and a Meta template name.
 */
export function templateNameEnvKey(event: NotifyEvent): string {
  return `WHATSAPP_TEMPLATE_NAME_${event.toUpperCase()}`;
}

export type TemplateNameMap = Record<NotifyEvent, string>;

/**
 * Approved Meta template names, one per event.
 *
 * Defaults to the event name itself — the templates are approved in WhatsApp
 * Manager under exactly these names — so the EUM path needs no per-event env
 * at all. Set an override only when a WABA template had to be named
 * differently. A blank override falls back to the default rather than
 * disabling the event, because an empty string is a typo, not an intention.
 */
export function readTemplateNames(
  env: NodeJS.ProcessEnv = process.env,
): TemplateNameMap {
  const out = {} as TemplateNameMap;
  for (const event of NOTIFY_EVENTS) {
    out[event] = env[templateNameEnvKey(event)]?.trim() || event;
  }
  return out;
}

/** Read one SID per chosen event. Absent/blank values stay undefined. */
export function readTemplateSids(
  env: NodeJS.ProcessEnv = process.env,
): TemplateSidMap {
  const out: TemplateSidMap = {};
  for (const event of NOTIFY_EVENTS) {
    const sid = env[templateEnvKey(event)]?.trim();
    if (sid) out[event] = sid;
  }
  return out;
}

/**
 * Positional variables per event — mirrors the approved template bodies.
 *
 *   welcome                  1 first name, 2 company name
 *   coi_issued               1 company name
 *   document_delivered       1 company name, 2 step title
 *   compliance_due_monthly   1 company name, 2 obligation name, 3 due date
 *   compliance_due_quarterly 1 company name, 2 obligation name, 3 due date
 *   compliance_overdue       1 company name, 2 obligation name
 */
function orderedVariables(
  event: NotifyEvent,
  vars: NotifyVariables,
): string[] {
  switch (event) {
    case 'welcome':
      return [vars.firstName ?? '', vars.companyName ?? ''];
    case 'coi_issued':
      return [vars.companyName ?? ''];
    case 'document_delivered':
      return [vars.companyName ?? '', vars.stepTitle ?? ''];
    case 'compliance_due_monthly':
    case 'compliance_due_quarterly':
      return [
        vars.companyName ?? '',
        vars.obligationName ?? '',
        vars.dueDate ?? '',
      ];
    case 'compliance_overdue':
      return [vars.companyName ?? '', vars.obligationName ?? ''];
  }
}

/**
 * WhatsApp rejects newlines and runs of whitespace inside a variable, and
 * Meta caps them well below the body limit. Collapse and clamp defensively.
 */
function sanitizeVariable(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** One typed text parameter in a Meta template component. */
type MetaTemplateParameter = { type: 'text'; text: string };

export type MetaTemplateComponent = {
  type: 'body';
  parameters: MetaTemplateParameter[];
};

/**
 * `components` array for the Meta Cloud API template payload (AWS EUM path).
 *
 * Same ordered values as `buildContentVariables`, different shape. An event
 * with no variables yields an empty array rather than a body component with
 * no parameters, which Meta rejects.
 */
export function buildTemplateComponents(
  event: NotifyEvent,
  vars: NotifyVariables,
): MetaTemplateComponent[] {
  const ordered = orderedVariables(event, vars);
  if (ordered.length === 0) return [];
  return [
    {
      type: 'body',
      parameters: ordered.map((value) => ({
        type: 'text',
        text: sanitizeVariable(value),
      })),
    },
  ];
}

/** JSON string for Twilio's `contentVariables`, keyed by 1-based position. */
export function buildContentVariables(
  event: NotifyEvent,
  vars: NotifyVariables,
): string {
  const ordered = orderedVariables(event, vars);
  const payload: Record<string, string> = {};
  ordered.forEach((value, index) => {
    payload[String(index + 1)] = sanitizeVariable(value);
  });
  return JSON.stringify(payload);
}

/** First name only — WhatsApp greetings read badly with a full legal name. */
export function firstNameOf(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] ?? 'there';
}
