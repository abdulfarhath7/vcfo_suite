import {
  NOTIFY_EVENTS,
  type NotifyEvent,
  type NotifyVariables,
} from '@/lib/notify/types';

/**
 * Event → Twilio Content Template SID + ordered content variables.
 *
 * Twilio's Content API takes `contentVariables` as a JSON object keyed by
 * position ("1", "2", ...). The order below must match the order of the
 * placeholders in the approved template body for that event.
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
