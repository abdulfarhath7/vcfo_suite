/**
 * Manual WhatsApp send (the console's WhatsApp page) — PURE, client-safe.
 *
 * One person, one approved template, its variables. The bodies below mirror
 * `docs/context/notes/whatsapp-templates.md` (the text approved in WhatsApp
 * Manager); they are only used to PREVIEW the message — what goes out is the
 * approved template, referenced by name, with these variables
 * (`buildTemplateComponents`). Nothing here builds a free-form message.
 */
import { NOTIFY_EVENTS, isNotifyEvent, type NotifyEvent, type NotifyVariables } from '@/lib/notify/types';

export type TemplateField = keyof NotifyVariables;

export interface ManualTemplate {
  event: NotifyEvent;
  /** who the approved text is written for */
  audience: 'client' | 'firm';
  label: string;
  /** approved body, `{{n}}` placeholders in variable order */
  body: string;
  /** the variables, in `{{1}}, {{2}}…` order */
  fields: TemplateField[];
}

export const MANUAL_TEMPLATES: ManualTemplate[] = [
  { event: 'client_action_needed', audience: 'client', label: 'Details needed', body: 'Hello {{1}}, we need some details from you for "{{3}}" ({{2}}). Please sign in to VCFO Suite to fill them in.', fields: ['firstName', 'companyName', 'stepTitle'] },
  { event: 'step_awaiting_approval', audience: 'client', label: 'Step ready for approval', body: 'Hello {{1}}, your step {{2}} for {{3}} is ready for your approval. Please sign in to VCFO Suite to review it.', fields: ['firstName', 'stepTitle', 'companyName'] },
  { event: 'documents_shared', audience: 'client', label: 'Documents shared', body: 'Hello {{1}}, new documents for {{2}} have been shared with you. Please sign in to VCFO Suite to view them.', fields: ['firstName', 'companyName'] },
  { event: 'document_delivered', audience: 'client', label: 'Document ready', body: 'A new document for {{1}} is ready on "{{2}}". Please sign in to VCFO Suite to view it.', fields: ['companyName', 'stepTitle'] },
  { event: 'coi_issued', audience: 'client', label: 'Certificate of Incorporation issued', body: 'Good news: the Certificate of Incorporation for {{1}} has been issued. You can download it in VCFO Suite.', fields: ['companyName'] },
  { event: 'welcome', audience: 'client', label: 'Welcome', body: 'Hello {{1}}, welcome to VCFO Suite. Your workspace for {{2}} is ready, please sign in to get started.', fields: ['firstName', 'companyName'] },
  { event: 'compliance_due_monthly', audience: 'client', label: 'Filing due (monthly)', body: 'Reminder for {{1}}: {{2}} is due on {{3}}. Please check VCFO Suite for details.', fields: ['companyName', 'obligationName', 'dueDate'] },
  { event: 'compliance_due_quarterly', audience: 'client', label: 'Filing due (quarterly)', body: 'Reminder for {{1}}: {{2}} is due on {{3}}. Please check VCFO Suite for details.', fields: ['companyName', 'obligationName', 'dueDate'] },
  { event: 'compliance_overdue', audience: 'client', label: 'Filing overdue', body: 'Reminder for {{1}}: {{2}} is now overdue. Please check VCFO Suite for the next steps.', fields: ['companyName', 'obligationName'] },
  { event: 'process_notice', audience: 'client', label: 'Short update', body: 'Update for {{1}}: {{2}}. Please sign in to VCFO Suite for details.', fields: ['companyName', 'stepTitle'] },
  // G-15 one-click Remind (origin/main, 30 Oct 2026): 1 company name, 2 the item still owed.
  { event: 'client_reminder', audience: 'client', label: 'Reminder', body: 'Reminder for {{1}}: {{2}} is still pending with you. Please sign in to VCFO Suite to complete it.', fields: ['companyName', 'stepTitle'] },
  { event: 'staff_client_submitted', audience: 'firm', label: 'Client submitted a step', body: 'Hello {{1}}, the client has submitted "{{3}}" for {{2}}. Please review it in VCFO Suite.', fields: ['firstName', 'companyName', 'stepTitle'] },
  { event: 'staff_client_uploaded', audience: 'firm', label: 'Client uploaded a document', body: 'Hello {{1}}, the client uploaded a document for "{{3}}" ({{2}}). Please check it in VCFO Suite.', fields: ['firstName', 'companyName', 'stepTitle'] },
  { event: 'staff_change_requested', audience: 'firm', label: 'Client asked for a change', body: 'Hello {{1}}, the client asked for a change on "{{3}}" for {{2}}. Please look at it in VCFO Suite.', fields: ['firstName', 'companyName', 'stepTitle'] },
  { event: 'phase_approved', audience: 'firm', label: 'Step approved', body: 'Hello {{1}}, the step "{{3}}" for {{2}} has been approved. You can see the details in VCFO Suite.', fields: ['firstName', 'companyName', 'stepTitle'] },
];

export const FIELD_LABEL: Record<TemplateField, string> = {
  firstName: 'First name',
  companyName: 'Company',
  stepTitle: 'Step',
  obligationName: 'Filing',
  dueDate: 'Due date',
};

/** process_notice's second variable is a short notice, not a step. */
export function fieldLabel(event: NotifyEvent, field: TemplateField): string {
  return event === 'process_notice' && field === 'stepTitle' ? 'Short notice' : FIELD_LABEL[field];
}

export const FIELD_MAX = 120;

export function manualTemplate(event: string): ManualTemplate | undefined {
  return MANUAL_TEMPLATES.find((t) => t.event === event);
}

/** WhatsApp collapses whitespace and clamps variables (templates.ts does the same on send). */
export function cleanVariable(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, FIELD_MAX);
}

/** The message as the person will read it. */
export function renderTemplateBody(t: ManualTemplate, vars: NotifyVariables): string {
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const field = t.fields[Number(n) - 1];
    const v = field ? cleanVariable(vars[field]) : '';
    return v || `[${field ? fieldLabel(t.event, field) : n}]`;
  });
}

export type ManualSendCheck =
  | { ok: true; event: NotifyEvent; variables: NotifyVariables }
  | { ok: false; error: 'unknown_template' | 'missing_field'; field?: TemplateField };

/** Server and page share this: an approved event, and every field of it filled. Extra keys are dropped. */
export function checkManualSend(event: string, raw: Record<string, unknown> | null | undefined): ManualSendCheck {
  if (!isNotifyEvent(event)) return { ok: false, error: 'unknown_template' };
  const t = manualTemplate(event);
  if (!t) return { ok: false, error: 'unknown_template' };
  const variables: NotifyVariables = {};
  for (const f of t.fields) {
    const v = cleanVariable(typeof raw?.[f] === 'string' ? (raw[f] as string) : '');
    if (!v) return { ok: false, error: 'missing_field', field: f };
    variables[f] = v;
  }
  return { ok: true, event, variables };
}

/** A staff screen shows a number only as its last four digits: `•••• 3210`. */
export function maskLast4(e164: string | null | undefined): string {
  const digits = (e164 ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `•••• ${digits.slice(-4)}`;
}

export type WhatsAppState = 'ready' | 'no_phone' | 'no_consent' | 'opted_out';

/** Same order as the dispatcher's guards (no_phone → no_consent → opted_out). */
export function whatsappStateOf(p: { phoneE164: string | null; whatsappOptInAt: Date | string | null; whatsappOptOutAt: Date | string | null }, isValidPhone: (v: string) => boolean): WhatsAppState {
  if (!p.phoneE164 || !isValidPhone(p.phoneE164)) return 'no_phone';
  if (!p.whatsappOptInAt) return 'no_consent';
  if (p.whatsappOptOutAt) return 'opted_out';
  return 'ready';
}

export const STATE_TEXT: Record<WhatsAppState, string> = {
  ready: 'WhatsApp on',
  no_phone: 'No WhatsApp number',
  no_consent: 'Has not agreed to WhatsApp',
  opted_out: 'Replied STOP',
};

/** Every event has a manual template (kept in step with NOTIFY_EVENTS). */
export const ALL_EVENTS_COVERED = NOTIFY_EVENTS.every((e) => MANUAL_TEMPLATES.some((t) => t.event === e));
